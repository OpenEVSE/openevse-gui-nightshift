# Unified Charge-Limit Card — Design

**Status:** Approved design. Date: 2026-06-02.

## Goal

Consolidate all charge-limit setting into one Dashboard card: the evcc-style bar
(now with a **% / range** unit toggle) sets SOC or range limits by drag, and a
single compact "Or limit by" row handles Time and Energy via the existing modal.
Replaces today's separate vehicle SOC bar + standalone Charge-limit card, and
removes Range from the modal.

## Background

Today the Dashboard renders two stacked pieces inside the `display !== 'error'`
block:
- `VehicleSocBar` (gated on `hasSoc`) — drag sets a `soc` `/limit`.
- `ChargeLimitCard` (gated on `!socLimitActive`) — a compact row → `ChargeLimitModal`
  (Time / Energy / Range).

The device holds exactly **one** `/limit` of one type at a time (`soc`, `range`,
`time`, `energy`); this contract is unchanged. SOC and range are the same physical
quantity in different units: when the vehicle reports both `battery_level` (%) and
`battery_range`, the pack's max range can be estimated as
`battery_range ÷ (battery_level / 100)`. So a range bar is the SOC bar relabelled —
no new geometry needed.

## What this builds

One card. Top: the unit-aware bar (when vehicle data is present). Below a divider:
the existing compact limit row (→ modal, now Time + Energy only). The card renders
whenever the Dashboard isn't in the error state, even with no vehicle (then the bar
is omitted and only the row shows).

### Components

**`ChargeLimitCard.svelte` — rewritten into the card container.**
Owns the card chrome (`bg-surface-2 rounded-xl`, padding) and composition:
- Header: a small "Charge limit" label, the vehicle info line (`range · to X`,
  unit-aware), and the **% / range toggle** — shown only when range is known.
- The bar (`VehicleSocBar`) — only when `hasSoc`.
- A divider, then the compact "Or limit by" row: `None set` + a `+ Set` affordance,
  or the active Time/Energy summary + a clear `✕` (today's `ChargeLimitCard`
  behavior, moved here).
- Props (from Dashboard): bar inputs (below), `limit` (the `$limit_store` value),
  `timeEnergySummary` (string), unit state + `onunit`, and callbacks
  `onTarget(pct)`, `onClearTarget`, `onOpenModal`, `onClearLimit`.

**`VehicleSocBar.svelte` — extended to be unit-aware; loses its own card chrome.**
The bar's geometry stays **percent-positioned** (fill = SOC%, vehicle marker =
`vehicle_charge_limit`%, knob = target%); only labels and the committed unit change:
- New props: `unit` (`'percent' | 'range'`), `estMaxRange` (number, for range
  labels), `rangeMiles` (bool). Existing: `soc`, `vehicleLimit`, `target` (all %),
  `charging`, `disabled`, `onchange`.
- `onchange` always emits the **target percent** (0–100); the parent converts to the
  soc/range value when writing. Geometry/cap/snap-to-clear logic is unchanged.
- Label rendering: percent mode → `"X%"`; range mode → `round(pct/100 · estMaxRange)`
  with the km/mi unit. The "EVSE limit"/"vehicle limit"/header values all follow the
  active unit.
- The bar no longer wraps itself in a card (`mt-3 rounded-xl bg-surface-2 …`); the
  container provides that. It renders just the header-less bar block (the info line
  moves to the card header).

**`ChargeLimitModal.svelte` — Time + Energy only.**
Remove the `range` option, its slider branch, the `rangeKm` state, and the
`allowRange` prop. Keep Time (hours/minutes) and Energy (kWh).

**`src/lib/dashboard/soc.js` — add range helpers; geometry unchanged.**
- `estMaxRange(batteryRange, soc)` → `soc > 0 ? batteryRange / (soc / 100) : null`.
- `rangeKnown(status)` helper or inline check: `battery_range != null && battery_level > 0`.
- Existing `socBarSegments` / `isCapped` / `socCeiling` / `hmsShort` keep their
  percent semantics (the bar stays in %). Names retained for continuity.

**`Dashboard.svelte` — compose + unit-aware writes.**
- Replace the separate `<VehicleSocBar>` and `<ChargeLimitCard>` blocks with a single
  `<ChargeLimitCard>` that receives the bar inputs and the limit row data.
- Unit state: `let limitUnit = $state('percent')`, plus an effect/derivation that
  defaults it to `'range'` when the active limit is `range` (and to `'percent'`
  otherwise) on load; the toggle sets it thereafter. Toggle only offered when
  `rangeKnown`.
- `estMaxRange` derived from `$status_store`.
- `socTarget` (knob %) derived from the active limit: `soc` → value; `range` →
  `value / estMaxRange · 100`; else `socCeiling(vehicleLimit)`.
- `setTarget(pct)` (replaces `setSocTarget`): `ceiling = socCeiling(vehicleLimit)`;
  if `pct >= ceiling` → clear the limit if one is active (snap-to-clear); else write
  `{type:'soc', value: pct}` in percent mode, or `{type:'range', value: round(pct/100
  · estMaxRange)}` in range mode. Routed through `serialQueue` + `download`, with the
  `rateNonce`-style remount-on-failure (reuse `socNonce`).
- Time/Energy: keep `saveLimit`/`clearLimit`/`limitSummary` as today; pass
  `allowRange` no more; modal opened from the card's row.
- `socLimitActive` becomes `limitActive = $limit_store?.type === 'soc' || === 'range'`
  for "is the bar's drag the active limit"; the compact row shows when the active
  limit is time/energy (or none).

### Visual / states (validated in mockups)

- Bar drag target **dims** when a time/energy limit is active (no soc/range limit in
  force), matching the SOC-bar's existing "no limit" dim.
- Active time/energy limit shows its summary + clear `✕` in the row; the `+ Set`
  affordance shows when none is set.
- `% / range` toggle in the card header, only when range is known; toggling only
  relabels (writes nothing).
- No vehicle (`battery_level` absent) → bar omitted; the row alone remains so Time/
  Energy still work.
- Single active limit: dragging the bar replaces any time/energy limit; setting
  time/energy resets the bar's knob to its resting (no-limit) position.

## i18n

Reuse `dashboard.limit.*` (label, none, set, clear, type_time, type_energy, hours,
minutes, energy_value, save) and `dashboard.vehicle.*` (charging_to, vehicle_limit,
evse_limit, to_full, target_aria). Add: `dashboard.limit.or_limit_by` ("Or limit
by"), `dashboard.vehicle.unit_percent` ("%"), `dashboard.vehicle.unit_range` (km/mi
handled via existing `units.km`/`units.miles`), `dashboard.vehicle.unit_aria`
("Limit units"). Remove the now-orphaned `dashboard.limit.type_range` only if nothing
else uses it (verify). All locale files (en/es/fr/hu).

## Testing

- `soc.js`: unit-test `estMaxRange` (normal, soc 0 → null, missing range → null).
- `VehicleSocBar`: percent mode unchanged (existing tests); add range-mode tests —
  labels render in km (e.g. target pct 60 with estMaxRange 278 → "167 km"), `onchange`
  still emits the percent; miles unit respected.
- `ChargeLimitCard` (rewritten): renders the bar when `hasSoc`; shows the toggle only
  when range known; shows `None set` / active summary + clear; fires `onOpenModal`,
  `onClearLimit`, `onunit`, `onTarget`, `onClearTarget`.
- `ChargeLimitModal`: range option gone (type select offers Time/Energy); existing
  energy-default + reset tests still pass.
- `Dashboard`: a `range` limit positions the knob correctly and the unit defaults to
  range; dragging in range mode POSTs `/limit` with `{type:'range', value:<km>}`;
  dragging in percent mode POSTs `/limit` with `{type:'soc', value:<pct>}`; setting/
  clearing time/energy still works; bar hidden with no `battery_level`.

Coverage stays scoped to `src/lib/**/*.js` (helpers carry it; components covered via
the Svelte test setup).

## Out of scope

- The deferred SOC charging-pulse animation.
- Any change to the mode/rate pills, eco/shaper, boost, or stat chips.
- Writing limits back to the vehicle (HA is read-only here).
- Reworking the device `/limit` contract.
