# Vehicle SOC Bar — Design

**Status:** Approved design. Date: 2026-06-01.

> **Revision 2026-06-02 (post-hardware UX pass).** After seeing it on an iPhone,
> the interaction model and layout changed. This revision supersedes the
> "draggable target" / cap-note / clear-button sections below where they conflict:
>
> - **Marker renamed** from "target" to **"EVSE limit"** (distinguishes it from the
>   car's "vehicle limit").
> - **No clear (×) button.** Clearing is **snap-to-clear**: a knob value **at or above
>   the vehicle limit (the "ceiling" = vehicle limit, or 100% if unknown) means "no
>   OpenEVSE limit."** Releasing there removes the `/limit`; the knob rests on the
>   amber vehicle-limit line (dimmed). Below the line = an active soc limit.
> - **Dragging above the vehicle limit shows the EVSE-limit marker + label in red**
>   (live feedback that it exceeds the car's cap) — this **replaces the amber cap-note
>   text and the hatch fill, both removed.** Red is transient: on release above the
>   line it snaps back and clears.
> - **Layout:** the bar lives in a fixed-height block (~84px) that reserves space for
>   the bubble (above) and the vehicle-limit label (below) so nothing overflows the
>   card or collides on narrow screens; the header info line truncates with `…`.
> - Helper change: `restingTarget` → `socCeiling(vehicleLimit)` (vehicle limit, or 100);
>   `socBarSegments` no longer returns hatch fields.

## Goal

Add an evcc-style vehicle State-of-Charge bar to the Dashboard. It shows the
live SOC, lets the user drag a target to set OpenEVSE's "stop charging at X%"
limit, and shows the vehicle's *own* charge limit as a read-only reference —
making clear that OpenEVSE can't charge past the vehicle's limit.

## Background

The HA / vehicle integration surfaces four fields in `/status`:

| Field | Meaning | Units |
|---|---|---|
| `battery_level` | current SOC | % (0–100) |
| `battery_range` | remaining range | km, or miles when `config.mqtt_vehicle_range_miles` |
| `time_to_full_charge` | est. time to full | seconds (0 = none/full) |
| `vehicle_charge_limit` | the car's own charge limit | % (0–100) |

The first three are already read on the Monitoring page (`vehicleMetrics`).
`vehicle_charge_limit` is new to `/status` (surfaced by the firmware) and not yet
consumed in the GUI.

OpenEVSE's own charge limit is the `/limit` endpoint. It already supports
`type: 'soc'` (stop at a SOC %), wired through `limit_store` and set today via
`ChargeLimitModal` → `Dashboard.saveLimit`. `/limit` holds a **single** limit of
one type at a time.

## What this builds

A new presentational component `VehicleSocBar.svelte` plus a pure helper module
`src/lib/dashboard/soc.js`. The Dashboard wires stores to the component, exactly
as it does for `ChargeRate` and `ChargeLimitCard`.

### Visual (settled with the user)

A horizontal rounded bar (0–100%) with three things layered on it:

- **Fill** — solid accent gradient from 0 to the current SOC. Rounded left
  corners, **flat right edge** so it meets the track cleanly. SOC % printed
  inside the fill at the left.
- **"Will charge to" zone** — a lighter accent band from SOC up to the
  **effective stop** (see cap logic). Flat ends.
- **Vehicle-limit marker** — a thin (2px) amber vertical line at
  `vehicle_charge_limit`, with the label **"vehicle limit X%"** *below* the bar.
  Read-only.
- **Target knob** — a wide (~6px) rounded white vertical line at the target %,
  with a small bubble label **"target X%"** *above* the bar (same small gap from
  the line as the vehicle-limit label has). This is the draggable control.

Header line (right of a "Vehicle" label): `range · charging to X%`, where X is
the effective stop. Append time-to-full ("· 1h 20m to full") only while charging
and `time_to_full_charge > 0`. Each piece is omitted when its value is missing.

A live charging **pulse** animation along the fill was explored and **deferred** —
not in this build. Leave room for it (and honour `prefers-reduced-motion` when it
lands).

### Cap logic (vehicle limit is a hard ceiling)

The car stops at its own limit, so the **effective stop = `min(target,
vehicleLimit)`** (when `vehicleLimit` is known).

- The "will charge to" zone extends only to the effective stop.
- When `target > vehicleLimit`: the stretch from `vehicleLimit` to `target` is
  drawn as a faint 45° amber hatch (unreachable); the target line is dimmed
  (~55% opacity); and an amber note shows: **"Vehicle stops at its own X% limit
  — target above it won't charge further."** The note appears **whenever
  `target > vehicleLimit`**, charging or not.
- The header's "charging to" value is the effective stop, not the raw target.

### Target / limit behavior

- **Source of truth** is `limit_store`. The target is "active" when the current
  limit `type === 'soc'`; its value is the knob position.
- **No soc limit set:** the knob **rests at the vehicle limit** (or `80%` if
  `vehicle_charge_limit` is unknown) and is drawn dimmed/inactive. It does *not*
  write anything until the user acts — so a time/energy/range limit set elsewhere
  is never silently overwritten.
- **Drag commits on release** (`onchange`, not `oninput`): write
  `limit_store.upload({ type: 'soc', value, auto_release: true })` through
  `serialQueue`, then `limit_store.download()` — the existing `saveLimit` path.
  This replaces any other active limit (consistent with the single-limit device
  and the bar "owning the SOC path").
- **Clear:** when an soc limit is active, show a small "×" → `limit_store.remove()`
  through `serialQueue`. The knob returns to its resting (vehicle-limit) position.
- Writes are gated on the Dashboard `busy` flag. On a failed write, revert the
  knob to the confirmed value (remount via a `socNonce`, mirroring `ChargeRate`'s
  `rateNonce`).

### Single-limit coordination

- Remove the `soc` option from `ChargeLimitModal` (it keeps **time / energy /
  range**). The bar is now the only way to set an soc limit.
- `ChargeLimitCard` **skips rendering when the active limit `type === 'soc'`** —
  the bar already represents it, so no duplicate control. It still shows for
  time/energy/range limits.

## Placement & visibility

- Renders only when `battery_level` is present in `/status`.
- Position: inside the dashboard `section`, **below `StatChips`, above
  `ChargeLimitCard`** (and within the existing `display !== 'error'` block, like
  the other controls).

## Architecture

```
src/lib/components/dashboard/VehicleSocBar.svelte   (new — presentational)
  props:  soc, vehicleLimit, target, range, rangeMiles, timeToFull,
          charging, limitActive, disabled
  events: onchange(targetPct), onclear()

src/lib/dashboard/soc.js                            (new — pure helpers)
  effectiveStop(target, vehicleLimit) -> number
  isCapped(target, vehicleLimit) -> boolean
  socBarSegments({ soc, target, vehicleLimit }) -> { fillPct, zoneEndPct, hatchStartPct, hatchEndPct }
  restingTarget(vehicleLimit) -> number          // vehicleLimit ?? 80
  formatVehicleLine({ range, rangeMiles, effectiveStop, timeToFull, charging }, t) -> string

src/routes/Dashboard.svelte                         (modify — wiring only)
  derive soc/vehicleLimit/target/charging from stores; render <VehicleSocBar>;
  add setSocTarget()/clearSocLimit(); gate ChargeLimitCard on non-soc limit.

src/lib/components/dashboard/ChargeLimitModal.svelte (modify — drop soc option)
```

The component holds no store knowledge; the Dashboard is the only store-aware
unit (matches the established `ChargeRate`/`ChargeLimitCard` pattern). The helper
module is DOM/store-free and fully unit-tested.

## Data flow

1. WebSocket/`DataManager` keeps `status_store` live → `battery_level`,
   `battery_range`, `time_to_full_charge`, `vehicle_charge_limit`.
2. `limit_store` holds the active `/limit` (refreshed on version bump and after
   writes).
3. Dashboard derives the view-model and passes scalars to `VehicleSocBar`.
4. User drags → `onchange(target)` → Dashboard `setSocTarget` → `serialQueue` →
   `limit_store.upload` + `download`. User clears → `onclear` → `limit_store.remove`.

## Edge cases

- `vehicle_charge_limit` missing/undefined → no amber marker, no cap note; resting
  target defaults to `80`.
- `battery_level` missing → whole card hidden.
- `time_to_full_charge === 0` or not charging → omit the "to full" text.
- SOC ≥ target → fill simply reaches/passes the target; no zone.
- Range unit follows `config.mqtt_vehicle_range_miles` (reuse Monitoring's
  convention).

## i18n

New keys under `dashboard.vehicle.*` (label, `charging_to`, `to_full`,
`vehicle_limit`, `target`, `cap_note`; reuse existing `units.*` for range/percent),
added to all four locale files: `en`, `es`, `fr`, `hu`. Any keys left orphaned by
the dropped modal soc option are removed from all four.

## Testing

- `src/lib/dashboard/__tests__/soc.test.js` — unit tests for `effectiveStop`,
  `isCapped`, `socBarSegments`, `restingTarget`, `formatVehicleLine` (incl. miles,
  zero time-to-full, missing vehicle limit, capped vs normal). Coverage is scoped
  to `src/lib/**/*.js`, so the helpers carry the coverage.
- Component test (`VehicleSocBar.test.js`) via the existing Svelte test setup:
  renders markers at correct positions, emits `onchange` on commit, shows/hides
  cap note and clear control.
- Update `ChargeLimitModal` tests for the removed soc option; update any
  `Dashboard` test touching the limit card's visibility.

## Out of scope

- The live charging pulse animation (deferred — revisit later).
- Writing the limit back to the vehicle (HA integration is read-only here).
- TFT / device-display changes (firmware side, separate tree).
- Any new `/status` or firmware field work.
