# Charging Session Chart — Design

**Date:** 2026-06-02
**Status:** Approved (brainstorm)

## Goal

While the EVSE is charging, the dashboard's hero slot morphs from the PowerRing
into a **current-session combo chart**: SOC bars (left axis, 0–100%) plus a kW
line (right axis), with a live "you are here" dot and a dashed target-limit line.
When not charging, the existing PowerRing returns unchanged.

This answers "where is the live ring value within the session" by showing the kW
history behind the ring's instantaneous number, alongside how SOC has climbed.

## Data

### Source

Existing `/energy/raw` endpoint via `energy_store.loadRaw()`. Samples now carry an
SOC field added by the firmware:

```
{ "ts": <unix s>, "a": <amps>, "t": <temp °C>, "e": <energy>, "s": <soc %> }
```

- `s` is integer SOC percent. `s < 0` (firmware sends `-1`) means **no vehicle
  source is reporting** — render as a gap (no bar), never as `0`.

The raw log is a rolling window with an `older`/`current` pager (see
`EnergyTab.svelte`). It is **not** version-bumped like the pull stores, so the
chart must refresh it on its own cadence.

### Derivations

- **kW per sample** = `sample.a × status.voltage`. Per-sample voltage is not
  logged; multiplying by the *current* `status.voltage` is an accepted
  approximation for AC charging (voltage is ~constant). When voltage is missing
  or `0`, the kW series is omitted.
- **SOC per sample** = `sample.s`, with `s < 0` → `null` (gap).
- **Session clip:** `sessionStart = latestSampleTs − status.session_elapsed`
  (`session_elapsed` is in seconds). The chart uses only samples with
  `ts ≥ sessionStart`. X-axis is session-relative.
- **kW axis max** scales like `EnergyLiveChart`: at least peak kW + headroom,
  with a sane floor.

## Layout (charging state)

Locked during brainstorm (mock variants "A" throughout):

```
┌ status row ─────────────────────────────┐
│  [Auto ▾]      ● Charging      [32 A ▾]  │   ← mode pill · status · rate pill
├ readout strip ──────────────────────────┤
│      3.2            │      74%           │
│      KW             │   SOC → 80%        │
├ session chart ──────────────────────────┤
│  100 ┊······························ limit 80% (dashed amber)
│      ┊   ╱‾‾‾‾‾‾╲___        kW line (accent) + ●live dot (amber)
│   ▁▂▃▄▅▆▇  SOC bars (accent translucent)        │
│   0 ────────────────────────── 8 (kW right axis)│
│   0        25m              50m                  │
└─────────────────────────────────────────┘
  [ Session 1.6 kWh · 50m ] [ Today 4.2 kWh ]   ← existing StatChips
  [ Charge-limit card ... ]                      ← existing ChargeLimitCard
```

- **Pills move into the status row** in the charging branch only (mode left,
  status centered, rate right). When idle they return to floating in the ring's
  top corners. This positional shift between states is intentional.
- **Readout strip** preserves the ring's at-a-glance identity: big kW value +
  "KW" label, divider, big SOC% + "SOC → <target>%".
- **Dashed limit line** at the target SOC recovers the cue the ring's progress
  arc provided.

## Components

### `SessionChart.svelte` (new, `src/lib/components/dashboard/`)

Pure presentational. Builds the dual-axis combo chart through the existing
`UplotChart.svelte` wrapper (same path `EnergyLiveChart` uses).

```
Props: { samples, voltage, target, sessionElapsed }
```

- Derives uPlot `data` and `opts` from props (SOC bars series on the left scale,
  kW line series on the right scale, dashed annotation at `target`).
- Renders a "collecting…" placeholder when fewer than 2 in-session samples exist.

### `ChargingHero.svelte` (new, `src/lib/components/dashboard/`)

The charging-state hero. Composes:
- Status row with `ModePill` / `RatePill` and the status label.
- Readout strip (kW · SOC → target).
- `SessionChart`.

```
Props: { kw, soc, target, mode, modeLocked, modeLockLabel,
         amps, maxAmps, rateClaimedBy, samples, voltage, sessionElapsed,
         disabled, onmode, onchange }
```

- On mount and every **10 s while charging**, calls `energy_store.loadRaw()`
  (routed through `serialQueue`, like all downloads). Stops the interval on
  destroy.
- Energy fetch error → render the status row + readout strip only, no chart
  (never blank the hero).

### `Dashboard.svelte` (modify)

Swap the hero by state:
- `display === 'charging'` → `ChargingHero` (pills passed in, not floated).
- otherwise → existing `PowerRing` + floating `ModePill` / `RatePill` (unchanged).

Idle ↔ charging is a simple crossfade.

## Pure helpers (`src/lib/dashboard/sessionChart.js`, new)

Extracted so they are unit-testable under the coverage-scoped `src/lib/**`:

- `clipToSession(samples, sessionElapsed)` → samples with `ts ≥ latestTs − elapsed`.
- `sampleKw(sample, voltage)` → `a × voltage` (or `null` when voltage falsy).
- `socOrNull(sample)` → `s >= 0 ? s : null`.
- `toChartData(samples, voltage)` → `[x[], soc[], kw[]]` arrays for uPlot,
  applying the gap and kW rules above.
- `kwAxisMax(kwValues)` → peak + headroom with a floor.

## Edge cases

| Case | Behavior |
|------|----------|
| `s` is `-1` for the whole session | SOC bars absent; kW line only |
| < 2 in-session samples | "collecting…" placeholder, no plot |
| `/energy/raw` error | status row + readout strip only, no chart |
| `voltage` missing / `0` | kW series omitted; SOC bars still drawn |
| `prefers-reduced-motion` | live-dot pulse off (matches `.breathe` / `.soc-shimmer`) |
| not charging | PowerRing as today; no chart, pills float in corners |

## Testing

- **Pure helpers** (`sessionChart.js`): unit tests for clip boundary, kW
  derivation, SOC-gap handling, `toChartData` shaping, and `kwAxisMax`. This is
  the coverage-scoped path (`src/lib/**/*.js`).
- **Components**: render tests for `ChargingHero` (charging shows chart + readout
  + status-row pills; error hides chart but keeps readout) and `SessionChart`
  (placeholder under 2 samples), following existing dashboard component-test
  patterns (mock `svelte-i18n`).

## Out of scope

- Persisting/sampling SOC client-side (firmware now logs it).
- A history view spanning multiple sessions (`/energy/raw` pager already covers
  that need in the Energy tab).
- Range (km/mi) line — could layer on later using `battery_range`; not in v1.
