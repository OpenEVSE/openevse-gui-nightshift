# OpenEVSE GUI v3 — Monitoring Screen

**Date:** 2026-05-21
**Status:** Approved design (autonomous build — designed directly from v2 + the locked v3 Aurora language per the AUTONOMOUS-RUNBOOK)
**Repo:** `/home/rar/openevse-gui-v3`
**Builds on:** the v3 foundation, Dashboard, and Schedule, all merged to `main`.

## Summary

The Monitoring screen is v3's `/monitoring` route, currently a placeholder. It is a
**read-only diagnostics** view of the OpenEVSE device — live metrics, safety counters,
and the charge-claim ("manager") table. It replaces v2's "Monitoring" screen
(`src/routes/Monitoring.svelte` → `Data.svelte` + `Safety.svelte` + `Manager.svelte`).

This is the fourth of five v3 plans. It depends only on the merged foundation +
Dashboard + Schedule; it adds the Monitoring route, five Monitoring components, one new
UI primitive (`Tabs`), and one pure-logic module. It writes nothing to the device.

## Goals

- Reproduce v2's Monitoring feature set: a tabbed screen with **Data**, **Safety**, and
  **Manager** tabs.
- **Data tab** — live metric groups: Energy delivered, Sensors, Service, and a
  conditional Vehicle group, each a collapsible card of name/value/unit rows.
- **Safety tab** — error counters (current fault, GFCI, no-ground, stuck relay) and
  info counters (relay switch count), each with a green/amber/red severity badge.
- **Manager tab** — the charge-claim table: every claimed property, the client that
  owns it, and its current value.
- The Safety tab shows an alert dot on its tab when the device is in a fault state.
- Pure data-mapping logic isolated and unit-tested; only the route talks to stores.

## Non-Goals (deferred / out of scope)

- Any control or write — Monitoring is strictly read-only.
- Charts / history graphs (the History screen is its own plan).
- The Dashboard, Schedule, and History screens.

## Data sources

All live, all read-only:
- `status_store` — WebSocket-pushed live device state (energy totals, sensors,
  safety counters, fault `state`, claim version).
- `config_store` — sensor scale/offset, service current limits, vehicle-range unit.
- `claims_target_store` — `{ claims: {property → clientId}, properties: {property → value} }`.
- `uistates_store` — `error` flag (whether the device is currently in a fault state).

`clientid2name` and `getStateDesc` (already in `src/lib/utils.js`) map raw ids/state
codes to i18n keys.

## Visual Design

Aurora theme (dark default / light), brand teal accent. Mobile-first, inside the
route content area. Mirrors the Dashboard's card idiom and the Schedule's spacing.

### Screen layout

1. **Header row** — the screen title (`screen.monitoring`).
2. **Tab bar** (`Tabs` primitive) — three full-width segments: Data / Safety / Manager.
   The Safety segment carries a small red dot when `uistates.error` is set. The active
   segment uses the teal accent fill (same look as `SegmentedControl`).
3. **Tab body** — the active tab's content.

If the device is in a fault state on first paint, the screen opens on the **Safety**
tab (reproduces v2's `onMount` behavior).

### Data tab (`MetricsTab`)

A vertical stack of **collapsible metric groups** (`MetricGroup`). Each group is a
`Card`: a tappable header (group title + a chevron) and, when expanded, a list of
`MetricRow`s. Default expanded state mirrors v2: **Energy delivered** open, the rest
collapsed.

- **MetricRow** — label on the left (`text-text-dim`), value + unit on the right
  (`text-text`, value bold). A missing/non-numeric value renders as an em-dash.
- **Energy delivered** — Session, Total, Today, This week, This month, This year (kWh).
- **Sensors** — Pilot (A), Current (A), Voltage (V), EVSE temperature (°C),
  Temp 1–4 (°C, only sensors that report a real number), Sensor scale, Sensor offset.
- **Service** — Service level, Service min (A), Service max (A).
- **Vehicle** — shown only when the device reports vehicle data
  (`battery_level`/`battery_range` present, or a configured time-to-full): Last
  updated, Battery %, Range, Time to full.

### Safety tab (`SafetyTab`)

Two titled sections of count rows:

- **Errors** — when the device is currently faulted, a first row naming the fault
  (`getStateDesc(status.state)`) with a red badge; then GFCI count, No-ground count,
  Stuck-relay count — each badge green when the count is 0, red otherwise.
- **Info** — Relay switch count, with a severity badge: green ≤ 20 000, amber
  ≤ 40 000, red above.

Each row: label on the left, a pill badge on the right
(`bg-accent/15 text-accent` for ok, `text-warning` tint for amber, `text-error`
tint for red) carrying the count or fault name.

### Manager tab (`ManagerTab`)

The charge-claim table — one row per entry in `claims_target.claims`:
- Left: the claimed property name (e.g. "state", "charge_current").
- Right: a chip with the owning client's name (`clients.<name>`) and the property's
  current value (`active`/`disabled` strings are localised; numbers shown as-is).

When there are no active claims, a centered empty-state card.

## Architecture

### Components

```
src/routes/Monitoring.svelte                    composes the screen; the only store-aware unit
src/lib/components/ui/
  Tabs.svelte                                    NEW primitive — tab bar with optional alert dot
src/lib/components/monitoring/
  MetricsTab.svelte                              the Data tab — stacks the metric groups
  MetricGroup.svelte                             one collapsible titled group of rows
  MetricRow.svelte                               one label / value / unit row
  SafetyTab.svelte                               the Safety tab — error + info count rows
  ManagerTab.svelte                              the Manager tab — the claims table
src/lib/monitoring/metrics.js                    pure helpers (see Pure Logic)
```

Reused as-is: `Card`, `Icon`. `Tabs` is the one new primitive — a tab bar of n
segments, each `{ label, alert }`, with an `active` index and an `onchange` callback;
visually a `SegmentedControl` plus a per-tab alert dot.

Every Monitoring component receives plain props and emits callbacks; none imports a
store. `Monitoring.svelte` alone subscribes to the stores, derives the metric groups /
safety data / claim rows, holds the active-tab `$state`, and passes everything down.

### Pure logic — `src/lib/monitoring/metrics.js`

Self-contained (no store/DOM/utils imports — its own tiny `round`/time helpers),
fully unit-tested:

- `energyMetrics(status)` → `{ titleKey, rows }` — the energy group.
- `sensorMetrics(status, config)` → `{ titleKey, rows }` — sensors; temp 1–4 rows are
  included only when the raw reading is a finite number.
- `serviceMetrics(status, config)` → `{ titleKey, rows }`.
- `vehicleMetrics(status, config)` → `{ titleKey, rows }`.
- `showVehicle(status, config)` → boolean — whether the Vehicle group renders.
- `countSeverity(count, warning, alert)` → `'ok' | 'warning' | 'error'`.
- `safetyData(status, hasError)` → `{ errors: [...], infos: [...] }`, each row
  `{ key, count?, state?, severity }` (the error/fault row carries `state` so the
  component can call `getStateDesc`).
- `claimRows(claimsTarget)` → `[{ property, clientId, value }]`, one per `claims` key.

Each metric row is `{ labelKey, value, unit }` where `value` is the final display
value (number or string, or `null` for missing) and `unit` is a `units.*` i18n key
or `''`.

### Data flow

`Monitoring.svelte`:
- Reads `$status_store`, `$config_store`, `$claims_target_store`, `$uistates_store`.
- `$state` `activeTab` (0–2); initialised to 1 (Safety) when `uistates.error` is set
  at mount, else 0.
- Derives the metric groups, `safetyData`, and `claimRows` from the stores and passes
  them to the tab components.
- No write paths, no `serialQueue` usage — the screen never mutates device state.

## Error Handling

- Every store may be undefined at first paint — all reads use optional chaining;
  `metrics.js` treats missing fields as `null` (rendered as an em-dash).
- The screen has no writes, so there is no failed-write / AlertBox path here.
- A device fault surfaces as the Safety-tab alert dot and the fault row; the shell's
  global error banner fires independently.

## Testing

- **`src/lib/monitoring/metrics.js`** — pure functions unit-tested: each metric group
  builder (field selection, scaling, missing-value → `null`), `showVehicle` predicate,
  temp-sensor filtering, `countSeverity` boundaries (20 000 / 40 000), `safetyData`
  shape with and without an active fault, `claimRows` mapping.
- **`Tabs`** — renders n segments, marks the active one, fires `onchange`, shows the
  alert dot only when a tab's `alert` is set.
- **`MetricRow` / `MetricGroup`** — row renders label/value/unit and em-dash for
  `null`; group collapses/expands on header click.
- **`MetricsTab` / `SafetyTab` / `ManagerTab`** — render the expected rows from given
  props; `SafetyTab` badge colours follow severity; `ManagerTab` shows the empty state
  for no claims.
- **`Monitoring.svelte`** — integration test with mocked stores: the three tabs
  render; switching tabs swaps the body; a faulted device opens on Safety.
- Vitest + `@testing-library/svelte`; coverage scoped to `src/lib`.

## Mock fixture

The existing `dev/fixtures/status.json`, `config.json`, and `claims_target.json`
already carry representative values (energy totals, sensors, `gfcicount`/`nogndcount`,
`total_switches`, and two claims). No fixture change is required; the screen is
viewable via `npm run dev:mock` as-is.

## Decisions (judgment calls — per locked decision #2, recorded here)

1. **Tabbed layout kept.** v2 groups Monitoring into three tabs; the screen carries a
   lot of data. v3 keeps the three tabs (rendered with the new `Tabs` primitive in the
   Aurora language) rather than collapsing to one long scroll — faithful to v2's
   structure and decision #1.
2. **Relay-switch severity thresholds.** v2's `Safety.svelte` had a copy-paste bug in
   its switch-count class logic (`<= alert ? primary : <= alert ? warning : danger` —
   the middle branch was unreachable). v3 implements the evident intent via
   `countSeverity(count, 20000, 40000)`: green ≤ 20 000, amber ≤ 40 000, red above.
3. **Temp 1–4 rows are filtered.** v2 always renders Temp 1–4, showing `0 °C` for an
   absent sensor (whose raw value is `false`). v3 omits a temp-sensor row when its
   reading is not a finite number — the same data, without the misleading zero. Not a
   feature drop: an absent sensor has nothing to show.
4. **`vehicle_state_update` read from `status_store`.** v2 read the vehicle
   "last updated" value from `uistates_store`; the identical value lives on
   `status_store`. v3 reads it from `status_store` directly — fewer dependencies, same
   number.
5. **Per-client icons dropped from the Manager table.** v2's `ManagerTag` showed a
   per-client iconify glyph chosen by `displayIcon` (which itself reaches into the
   limit store). v3's claim row shows the localised client name and value in a chip;
   the icon carried no information the name doesn't. Presentation simplification, no
   feature lost.
6. **Vehicle range is shown raw** with its unit taken from
   `config.mqtt_vehicle_range_miles`; v2's `displayRange` miles/km conversion (a
   narrow, store-coupled case) is not reproduced. The Vehicle group only appears when
   the device reports vehicle data, which the standard fixture does not.

## Open Questions

None. All design decisions for this screen are resolved.
