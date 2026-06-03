# Home Assistant Data Sources Design

**Goal:** Let four more data feeds come from Home Assistant — solar/grid (eco divert), whole-home power (shaper), home-battery SoC/power (display-only), and two extra vehicle attributes (plugged-in, charging state) — reusing the existing vehicle-HA pattern.

**Approach:** Per-feature source selectors. Each feature page gets a `*_data_src` selector whose "Home Assistant" option appears only when `ha_supported`; when selected, `ha_*` entity-ID text fields appear inline. Firmware polls those entities into existing/new `status` fields; the GUI reads `status` exactly as it does today. All new config keys default to MQTT (`0`), so existing devices are unaffected.

**Gating:** Everything keys off the firmware-reported `ha_supported` flag, identical to today's vehicle-HA integration. No new Labs/`dev_features` flag.

---

## Scope

In scope (GUI + mock, all four):
1. **Solar / Eco divert** — solar production or grid import/export from HA.
2. **Shaper** — whole-home live power from HA.
3. **Home battery** — SoC and power from HA, **display-only** (no charging-logic change).
4. **Vehicle extras** — plugged-in state and charging state from HA.

Out of scope (explicitly deferred):
- Home battery influencing divert/eco logic.
- Odometer, battery state-of-health, vehicle location.
- A dashboard chip for the vehicle extras (Monitoring only for now).
- Refining home-battery placement (lives on the Solar page for now; revisit later).

---

## Firmware Requirements

> **Hand this section to the firmware agent.** The GUI change is inert without it. Each item lists the config key the GUI writes and the `status` field the GUI reads. The GUI never reads HA directly — firmware does the polling and writes `status`.

### Shared contract
- For each feature, when its `*_data_src` config value is `1` (Home Assistant), firmware polls the named HA entity (an entity ID string like `sensor.solar_power`) and writes the result into the existing/new `status` field. When `*_data_src` is `0` (MQTT, the default), behavior is unchanged.
- All `ha_*` config keys are entity-ID strings. Empty string means "not configured" — firmware should leave the corresponding `status` field absent/unchanged.
- `ha_supported` must be `true` for any of this to surface in the GUI (already the case for the vehicle integration).

### 1. Solar / Eco divert
| Config key (GUI writes) | Type | Meaning |
|---|---|---|
| `divert_data_src` | int | `0` = MQTT (default), `1` = Home Assistant |
| `ha_solar` | string | HA entity for solar production (W). Used when `divert_type == 0`. |
| `ha_grid_ie` | string | HA entity for grid import/export (W, +import/−export per existing convention). Used when `divert_type == 1`. |

- **status fields (already exist, no rename):** firmware writes `status.solar` and `status.grid_ie` from the HA entity instead of the MQTT topic when `divert_data_src == 1`.

### 2. Shaper
| Config key (GUI writes) | Type | Meaning |
|---|---|---|
| `shaper_data_src` | int | `0` = MQTT (default), `1` = Home Assistant |
| `ha_live_pwr` | string | HA entity for whole-home live power (W) |

- **status field (already exists):** firmware writes `status.shaper_live_pwr` from the HA entity when `shaper_data_src == 1`.

### 3. Home battery (display-only)
| Config key (GUI writes) | Type | Meaning |
|---|---|---|
| `ha_battery_soc` | string | HA entity for home-battery state of charge (%) |
| `ha_battery_power` | string | HA entity for home-battery power (W) — optional |

- **NEW status fields firmware must add:**
  - `status.home_battery_soc` — int/float, percent (0–100). Named distinctly from the vehicle's `battery_level` to avoid collision.
  - `status.home_battery_power` — int/float, watts (sign convention firmware's choice; GUI just displays the number with a `W` unit).
- Polled independently of divert; no `*_data_src` selector (HA is the only source). Firmware writes these whenever the entities are configured and `ha_supported`.

### 4. Vehicle extras
| Config key (GUI writes) | Type | Meaning |
|---|---|---|
| `ha_vehicle_plugged` | string | HA binary entity for cable-connected state |
| `ha_vehicle_charging_state` | string | HA entity for the vehicle's own charging state |

- **NEW status fields firmware must add:**
  - `status.vehicle_plugged` — bool.
  - `status.vehicle_charging_state` — string (firmware passes through the HA state, e.g. `"charging"`, `"complete"`, `"idle"`). GUI maps known values to localized labels and falls back to the raw string.
- These attach to the existing vehicle HA source (`vehicle_data_src == 4`), so they share that selector — no new `*_data_src` key.

### Firmware summary (new fields only)
- **New config keys:** `divert_data_src`, `shaper_data_src`, `ha_solar`, `ha_grid_ie`, `ha_live_pwr`, `ha_battery_soc`, `ha_battery_power`, `ha_vehicle_plugged`, `ha_vehicle_charging_state`.
- **New status fields:** `home_battery_soc`, `home_battery_power`, `vehicle_plugged`, `vehicle_charging_state`.
- **Reused status fields (no change):** `solar`, `grid_ie`, `shaper_live_pwr`.

---

## GUI Components & Data Flow

### Source-selector pattern (Solar, Shaper)
Mirror `Vehicle.svelte`: a `Select` whose options list conditionally appends the HA entry when `$config_store?.ha_supported`. The selected `*_data_src` controls which field renders — the existing MQTT `TextInput` (topic) or an HA `TextInput` (entity ID). Default `0` keeps current behavior.

- **`src/routes/settings/Solar.svelte`** — add `divert_data_src` selector. When `divert_data_src == 1`, replace the `mqtt_solar`/`mqtt_grid_ie` field (already switched by `divert_type`) with `ha_solar`/`ha_grid_ie`. The existing read-only rows (`status.solar`/`grid_ie`/`charge_rate`/`smoothed_available_current`) are unchanged. Add the Home Battery section (below).
- **`src/routes/settings/Shaper.svelte`** — add `shaper_data_src` selector. When `1`, replace the `mqtt_live_pwr` field with `ha_live_pwr`. Read-only rows unchanged.

### Home battery section (Solar page)
A new `ConfigSection` titled "Home Battery", rendered only when `ha_supported`: `ha_battery_soc` and `ha_battery_power` entity fields. Below them, a read-only SoC/power row rendered only when `status.home_battery_soc` is present.

### Vehicle extras (Vehicle page)
Inside the existing `{#if src === 4 && $config_store?.ha_supported}` HA section, add two more `TextInput` entity fields: `ha_vehicle_plugged`, `ha_vehicle_charging_state`. No structural change otherwise.

### Monitoring (logic in `src/lib/monitoring/metrics.js` — the test-covered layer)
- **`vehicleMetrics(status, config)`** — append two rows: plugged-in and charging state.
- **`homeBatteryMetrics(status)`** — new group `monitoring.group.home_battery` with SoC (%) and power (W) rows.
- **`showHomeBattery(status)`** — `true` when `status.home_battery_soc` is a finite number; gates the group.
- **Row `textKey` extension (`src/lib/components/monitoring/MetricRow.svelte`):** `MetricRow` currently takes `{labelKey, value, unit}`. Add an optional `textKey` prop; when set, the displayed value is `$_(textKey)` instead of the raw `value`. This keeps `metrics.js` pure (no i18n import) while supporting boolean/enum rows. Extend `MetricRow.test.js` accordingly.
  - Plugged-in: `vehicle_plugged === true` → `textKey: 'monitoring.vehicle.plugged_yes'`; `=== false` → `'..._no'`; missing → row omitted.
  - Charging state: known values map to `monitoring.vehicle.charging_*` keys; unknown non-empty strings pass through as a literal `value`; missing → row omitted.
- **`src/routes/Monitoring.svelte`** — import `homeBatteryMetrics`/`showHomeBattery` and add the group to the `groups` array, gated by `showHomeBattery($status_store)` exactly as `vehicleMetrics` is gated by `showVehicle`.

### i18n (`src/lib/i18n/{en,es,fr,hu}.json`)
New keys for: `config.solar.source`/`feed_solar_entity`/`feed_grid_entity` + home-battery labels; `config.shaper.source`/`live_entity`; `config.vehicle.entity_plugged`/`entity_charging_state` + source option labels reused from `config.vehicle.src_mqtt`/`src_homeassistant` where possible; `monitoring.group.home_battery`, `monitoring.home_battery.soc`/`power`, `monitoring.vehicle.plugged`/`plugged_yes`/`plugged_no`/`charging_state` + `charging_*` value labels. All four locales.

### Mock (`dev/fixtures/`)
- **`config.json`** — `divert_data_src: 1`, `shaper_data_src: 1`, and the entity strings: `ha_solar`, `ha_grid_ie`, `ha_live_pwr`, `ha_battery_soc`, `ha_battery_power`, `ha_vehicle_plugged`, `ha_vehicle_charging_state`. (`ha_supported` is already `true`.)
- **`status.json`** — add `home_battery_soc`, `home_battery_power`, `vehicle_plugged: true`, `vehicle_charging_state: "charging"`. (`solar`, `grid_ie`, `shaper_live_pwr` already exist.)
- No new mock endpoints — all of this rides the existing `/config` and `/status` responses. Mock fixtures load once at server start, so a `dev:mock` restart is required to see changes.

---

## Testing

- **`src/lib/monitoring/__tests__/metrics.test.js`** — cover:
  - `vehicleMetrics` includes plugged/charging rows when fields present; omits them when absent; correct `textKey` for plugged true/false; charging-state known→key vs unknown→literal.
  - `homeBatteryMetrics` row shape and values.
  - `showHomeBattery` true/false/non-numeric.
- `.svelte` files are outside coverage scope (`src/lib/**/*.js` only), so the selector conditionals are kept as trivial inline logic and verified manually in `dev:mock`.
- Full suite (`npm test`) must stay green.

---

## File Structure

| File | Change |
|---|---|
| `src/routes/settings/Solar.svelte` | `divert_data_src` selector, HA entity fields, Home Battery section + read-only row |
| `src/routes/settings/Shaper.svelte` | `shaper_data_src` selector, `ha_live_pwr` entity field |
| `src/routes/settings/Vehicle.svelte` | `ha_vehicle_plugged` + `ha_vehicle_charging_state` entity fields |
| `src/lib/monitoring/metrics.js` | extend `vehicleMetrics`/`showVehicle`, add `homeBatteryMetrics`/`showHomeBattery`, `textKey` rows |
| `src/lib/components/monitoring/MetricRow.svelte` | add optional `textKey` prop to the row renderer |
| `src/routes/Monitoring.svelte` | wire home-battery group into the `groups` array |
| `src/lib/i18n/{en,es,fr,hu}.json` | new labels (4 locales) |
| `dev/fixtures/config.json`, `dev/fixtures/status.json` | mock the new keys/fields |
| `src/lib/monitoring/__tests__/metrics.test.js` | unit tests for the metrics changes |
| `src/lib/components/monitoring/__tests__/MetricRow.test.js` | test the `textKey` branch |
