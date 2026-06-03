# Home Assistant Data Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let solar/grid (eco divert), whole-home power (shaper), home-battery SoC/power (display-only), and two vehicle attributes (plugged-in, charging state) be sourced from Home Assistant, reusing the existing vehicle-HA pattern.

**Architecture:** Per-feature `*_data_src` selectors whose "Home Assistant" option appears only when `ha_supported`; when selected, `ha_*` entity-ID text fields render inline. Firmware polls those entities into `status` fields; the GUI reads `status` unchanged. All new `*_data_src` keys default to `0` (MQTT) for backward compatibility. Pure display logic lives in `src/lib/monitoring/metrics.js` (the test-covered layer).

**Tech Stack:** Svelte 5 runes, Tailwind 4, `svelte-i18n` (locales en/es/fr/hu, parity-enforced), Vitest + @testing-library/svelte. Dev mock via `dev/mock-plugin.js` + `dev/fixtures/`.

**Spec:** `docs/superpowers/specs/2026-06-03-ha-data-sources-design.md`

**Working directory:** `/home/rar/openevse-gui-nightshift` (branch `feat/ha-data-sources`, already created).

**Key conventions to respect:**
- `ha_supported` is **derived** in `src/lib/stores/config.js` from `ha_url !== undefined` — don't set it directly except in mock (mock already sets `ha_url`).
- `config.solar.source` is **already taken** (it labels the `divert_type` "Monitor" select). The new divert data-source selector MUST use the key `config.solar.data_source`.
- `src/lib/i18n/__tests__/locale-parity.test.js` requires **all four** locale files to have the exact same key paths. Every new key must be added to en, es, fr, and hu in the same commit.
- Coverage is scoped to `src/lib/**/*.js`. `.svelte` files don't count toward coverage but DO have component tests (e.g. `MetricRow.test.js`).
- Config writes go through `form.saveField('key', value)` from `createConfigForm()`; save status is `$ss.key`.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/lib/i18n/{en,es,fr,hu}.json` | All new UI labels (parity across 4 locales) | 1 |
| `src/lib/monitoring/metrics.js` | Vehicle extras rows, home-battery group, `showHomeBattery` | 2 |
| `src/lib/monitoring/__tests__/metrics.test.js` | Unit tests for the above | 2 |
| `src/lib/components/monitoring/MetricRow.svelte` | Optional `textKey` prop for boolean/enum rows | 3 |
| `src/lib/components/monitoring/__tests__/MetricRow.test.js` | Test the `textKey` branch | 3 |
| `src/routes/Monitoring.svelte` | Wire the home-battery group into `groups` | 4 |
| `src/routes/settings/Solar.svelte` | `divert_data_src` selector, HA entity fields, Home Battery section | 5 |
| `src/routes/settings/Shaper.svelte` | `shaper_data_src` selector, `ha_live_pwr` field | 6 |
| `src/routes/settings/Vehicle.svelte` | `ha_vehicle_plugged` + `ha_vehicle_charging_state` fields | 7 |
| `dev/fixtures/config.json`, `dev/fixtures/status.json` | Mock the new keys/fields | 8 |

---

## Task 1: i18n keys (all four locales)

**Files:**
- Modify: `src/lib/i18n/en.json`
- Modify: `src/lib/i18n/es.json`
- Modify: `src/lib/i18n/fr.json`
- Modify: `src/lib/i18n/hu.json`
- Test: `src/lib/i18n/__tests__/locale-parity.test.js` (existing — must stay green)

Insert each key into the matching existing nested block (`config.solar`, `config.shaper`, `config.vehicle`, `monitoring.group`, `monitoring.vehicle`, `units`). Create a **new** `monitoring.home_battery` block. The key set must be identical across all four files; only the string values differ.

- [ ] **Step 1: Add the English keys**

In `src/lib/i18n/en.json`, add to `config.solar`:
```json
"data_source": "Data source",
"data_mqtt": "MQTT",
"data_ha": "Home Assistant",
"feed_solar_entity": "Solar production entity",
"feed_grid_entity": "Grid import/export entity",
"home_battery": "Home Battery",
"home_battery_info": "Reads home-battery data from Home Assistant entities.",
"battery_soc_entity": "Battery SoC entity",
"battery_power_entity": "Battery power entity",
"battery_soc": "Battery SoC",
"battery_power": "Battery power"
```
Add to `config.shaper`:
```json
"data_source": "Data source",
"data_mqtt": "MQTT",
"data_ha": "Home Assistant",
"live_entity": "Live power entity"
```
Add to `config.vehicle`:
```json
"entity_plugged": "Plugged-in entity",
"entity_charging_state": "Charging state entity"
```
Add to `monitoring.group`:
```json
"home_battery": "Home Battery"
```
Add to `monitoring.vehicle`:
```json
"plugged": "Plugged in",
"plugged_yes": "Yes",
"plugged_no": "No",
"charging_state": "Charging state",
"charging_active": "Charging",
"charging_complete": "Complete",
"charging_idle": "Idle"
```
Add a new block `monitoring.home_battery`:
```json
"home_battery": { "soc": "State of charge", "power": "Power" }
```
Add to `units`:
```json
"watt": "W"
```

- [ ] **Step 2: Add the Spanish keys (`es.json`)** — same key paths, these values:

`config.solar`: `data_source` "Fuente de datos", `data_mqtt` "MQTT", `data_ha` "Home Assistant", `feed_solar_entity` "Entidad de producción solar", `feed_grid_entity` "Entidad de importación/exportación de red", `home_battery` "Batería doméstica", `home_battery_info` "Lee los datos de la batería doméstica desde entidades de Home Assistant.", `battery_soc_entity` "Entidad de SoC de la batería", `battery_power_entity` "Entidad de potencia de la batería", `battery_soc` "SoC de la batería", `battery_power` "Potencia de la batería"
`config.shaper`: `data_source` "Fuente de datos", `data_mqtt` "MQTT", `data_ha` "Home Assistant", `live_entity` "Entidad de potencia en vivo"
`config.vehicle`: `entity_plugged` "Entidad de conexión", `entity_charging_state` "Entidad de estado de carga"
`monitoring.group.home_battery`: "Batería doméstica"
`monitoring.vehicle`: `plugged` "Conectado", `plugged_yes` "Sí", `plugged_no` "No", `charging_state` "Estado de carga", `charging_active` "Cargando", `charging_complete` "Completa", `charging_idle` "Inactivo"
`monitoring.home_battery`: `soc` "Estado de carga", `power` "Potencia"
`units.watt`: "W"

- [ ] **Step 3: Add the French keys (`fr.json`)** — same key paths, these values:

`config.solar`: `data_source` "Source de données", `data_mqtt` "MQTT", `data_ha` "Home Assistant", `feed_solar_entity` "Entité de production solaire", `feed_grid_entity` "Entité d'import/export réseau", `home_battery` "Batterie domestique", `home_battery_info` "Lit les données de la batterie domestique depuis des entités Home Assistant.", `battery_soc_entity` "Entité de SoC de la batterie", `battery_power_entity` "Entité de puissance de la batterie", `battery_soc` "SoC de la batterie", `battery_power` "Puissance de la batterie"
`config.shaper`: `data_source` "Source de données", `data_mqtt` "MQTT", `data_ha` "Home Assistant", `live_entity` "Entité de puissance en direct"
`config.vehicle`: `entity_plugged` "Entité de branchement", `entity_charging_state` "Entité d'état de charge"
`monitoring.group.home_battery`: "Batterie domestique"
`monitoring.vehicle`: `plugged` "Branché", `plugged_yes` "Oui", `plugged_no` "Non", `charging_state` "État de charge", `charging_active` "En charge", `charging_complete` "Terminé", `charging_idle` "Inactif"
`monitoring.home_battery`: `soc` "État de charge", `power` "Puissance"
`units.watt`: "W"

- [ ] **Step 4: Add the Hungarian keys (`hu.json`)** — same key paths, these values:

`config.solar`: `data_source` "Adatforrás", `data_mqtt` "MQTT", `data_ha` "Home Assistant", `feed_solar_entity` "Napelem-termelés entitás", `feed_grid_entity` "Hálózati import/export entitás", `home_battery` "Otthoni akkumulátor", `home_battery_info` "Az otthoni akkumulátor adatait Home Assistant entitásokból olvassa be.", `battery_soc_entity` "Akkumulátor töltöttség entitás", `battery_power_entity` "Akkumulátor teljesítmény entitás", `battery_soc` "Akkumulátor töltöttség", `battery_power` "Akkumulátor teljesítmény"
`config.shaper`: `data_source` "Adatforrás", `data_mqtt` "MQTT", `data_ha` "Home Assistant", `live_entity` "Élő teljesítmény entitás"
`config.vehicle`: `entity_plugged` "Csatlakozás entitás", `entity_charging_state` "Töltési állapot entitás"
`monitoring.group.home_battery`: "Otthoni akkumulátor"
`monitoring.vehicle`: `plugged` "Csatlakoztatva", `plugged_yes` "Igen", `plugged_no` "Nem", `charging_state` "Töltési állapot", `charging_active` "Töltés", `charging_complete` "Kész", `charging_idle` "Tétlen"
`monitoring.home_battery`: `soc` "Töltöttség", `power` "Teljesítmény"
`units.watt`: "W"

- [ ] **Step 5: Run the parity + monitoring i18n tests**

Run: `cd /home/rar/openevse-gui-nightshift && npx vitest run src/lib/i18n/__tests__/locale-parity.test.js src/lib/i18n/__tests__/monitoring-i18n.test.js`
Expected: PASS. If parity fails, the failure message names the mismatched key path — add/remove it so all four locales match.

- [ ] **Step 6: Commit**

```bash
cd /home/rar/openevse-gui-nightshift
git add src/lib/i18n/en.json src/lib/i18n/es.json src/lib/i18n/fr.json src/lib/i18n/hu.json
git commit -m "i18n: keys for HA data sources"
```

---

## Task 2: metrics.js — vehicle extras + home-battery group

**Files:**
- Modify: `src/lib/monitoring/metrics.js` (`vehicleMetrics` ~76-88, `showVehicle` ~91-95; add new exports)
- Test: `src/lib/monitoring/__tests__/metrics.test.js`

Rows may now carry an optional `textKey` (an i18n key) instead of a numeric `value`; the renderer (Task 3) translates it. This keeps `metrics.js` free of i18n imports. `showVehicle` is unchanged — plugged/charging rows only appear when the existing vehicle group already shows.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/monitoring/__tests__/metrics.test.js`. Also add `homeBatteryMetrics, showHomeBattery` to the existing import at the top of the file.
```js
describe('vehicleMetrics extras', () => {
  const byLabel = (g) => Object.fromEntries(g.rows.map((r) => [r.labelKey, r]))

  it('omits plugged and charging rows when absent', () => {
    const m = byLabel(vehicleMetrics({ battery_level: 80 }, {}))
    expect(m['monitoring.vehicle.plugged']).toBeUndefined()
    expect(m['monitoring.vehicle.charging_state']).toBeUndefined()
  })
  it('renders plugged as a yes/no textKey', () => {
    expect(byLabel(vehicleMetrics({ vehicle_plugged: true }, {}))['monitoring.vehicle.plugged'])
      .toEqual({ labelKey: 'monitoring.vehicle.plugged', textKey: 'monitoring.vehicle.plugged_yes', unit: '' })
    expect(byLabel(vehicleMetrics({ vehicle_plugged: false }, {}))['monitoring.vehicle.plugged'].textKey)
      .toBe('monitoring.vehicle.plugged_no')
  })
  it('maps a known charging state to a textKey', () => {
    expect(byLabel(vehicleMetrics({ vehicle_charging_state: 'Charging' }, {}))['monitoring.vehicle.charging_state'])
      .toEqual({ labelKey: 'monitoring.vehicle.charging_state', textKey: 'monitoring.vehicle.charging_active', unit: '' })
  })
  it('passes an unknown charging state through as a literal value', () => {
    expect(byLabel(vehicleMetrics({ vehicle_charging_state: 'Preconditioning' }, {}))['monitoring.vehicle.charging_state'])
      .toEqual({ labelKey: 'monitoring.vehicle.charging_state', value: 'Preconditioning', unit: '' })
  })
  it('ignores an empty charging state string', () => {
    expect(byLabel(vehicleMetrics({ vehicle_charging_state: '' }, {}))['monitoring.vehicle.charging_state'])
      .toBeUndefined()
  })
})

describe('homeBatteryMetrics / showHomeBattery', () => {
  it('builds soc and power rows', () => {
    const g = homeBatteryMetrics({ home_battery_soc: 82.4, home_battery_power: -1200 })
    expect(g.titleKey).toBe('monitoring.group.home_battery')
    const byLabel = Object.fromEntries(g.rows.map((r) => [r.labelKey, r]))
    expect(byLabel['monitoring.home_battery.soc']).toEqual({ labelKey: 'monitoring.home_battery.soc', value: 82, unit: 'units.percent' })
    expect(byLabel['monitoring.home_battery.power']).toEqual({ labelKey: 'monitoring.home_battery.power', value: -1200, unit: 'units.watt' })
  })
  it('shows only when home_battery_soc is a real number', () => {
    expect(showHomeBattery({ home_battery_soc: 0 })).toBe(true)
    expect(showHomeBattery({ home_battery_soc: 82 })).toBe(true)
    expect(showHomeBattery({})).toBe(false)
    expect(showHomeBattery({ home_battery_soc: null })).toBe(false)
    expect(showHomeBattery({ home_battery_soc: false })).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/rar/openevse-gui-nightshift && npx vitest run src/lib/monitoring/__tests__/metrics.test.js`
Expected: FAIL — `homeBatteryMetrics`/`showHomeBattery` are not exported, and the extras rows are missing.

- [ ] **Step 3: Implement in `src/lib/monitoring/metrics.js`**

Add this module-level constant near the top (after the imports):
```js
/** HA vehicle charging-state strings → localized label keys. Unknown values pass through. */
const CHARGING_STATE_KEYS = {
  charging: 'monitoring.vehicle.charging_active',
  complete: 'monitoring.vehicle.charging_complete',
  charged: 'monitoring.vehicle.charging_complete',
  full: 'monitoring.vehicle.charging_complete',
  idle: 'monitoring.vehicle.charging_idle',
  stopped: 'monitoring.vehicle.charging_idle',
  disconnected: 'monitoring.vehicle.charging_idle',
}
```
Replace the `vehicleMetrics` function body so it builds the base rows, then conditionally appends the two extras:
```js
export function vehicleMetrics(status, config) {
  const s = status ?? {}
  const c = config ?? {}
  const rows = [
    { labelKey: 'monitoring.vehicle.updated', value: hms(s.vehicle_state_update), unit: '' },
    { labelKey: 'monitoring.vehicle.battery', value: s.battery_level ?? null, unit: 'units.percent' },
    { labelKey: 'monitoring.vehicle.range', value: s.battery_range ?? null, unit: c.mqtt_vehicle_range_miles ? 'units.miles' : 'units.km' },
    { labelKey: 'monitoring.vehicle.timeleft', value: hms(s.time_to_full_charge), unit: '' },
  ]
  if (s.vehicle_plugged !== undefined && s.vehicle_plugged !== null) {
    rows.push({
      labelKey: 'monitoring.vehicle.plugged',
      textKey: s.vehicle_plugged ? 'monitoring.vehicle.plugged_yes' : 'monitoring.vehicle.plugged_no',
      unit: '',
    })
  }
  if (typeof s.vehicle_charging_state === 'string' && s.vehicle_charging_state.trim() !== '') {
    const key = CHARGING_STATE_KEYS[s.vehicle_charging_state.trim().toLowerCase()]
    rows.push(key
      ? { labelKey: 'monitoring.vehicle.charging_state', textKey: key, unit: '' }
      : { labelKey: 'monitoring.vehicle.charging_state', value: s.vehicle_charging_state, unit: '' })
  }
  return { titleKey: 'monitoring.group.vehicle', rows }
}
```
Add the two new exports below `showVehicle`:
```js
export function homeBatteryMetrics(status) {
  const s = status ?? {}
  return {
    titleKey: 'monitoring.group.home_battery',
    rows: [
      { labelKey: 'monitoring.home_battery.soc', value: round(s.home_battery_soc, 0), unit: 'units.percent' },
      { labelKey: 'monitoring.home_battery.power', value: round(s.home_battery_power, 0), unit: 'units.watt' },
    ],
  }
}

/** Whether the Home Battery group should render. */
export function showHomeBattery(status) {
  return round((status ?? {}).home_battery_soc, 0) !== null
}
```
(`round` already returns `null` for `null`/`undefined`/`''`/boolean/non-finite, so `showHomeBattery` correctly rejects those and accepts `0`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/rar/openevse-gui-nightshift && npx vitest run src/lib/monitoring/__tests__/metrics.test.js`
Expected: PASS (new tests + all existing `metrics` tests).

- [ ] **Step 5: Commit**

```bash
cd /home/rar/openevse-gui-nightshift
git add src/lib/monitoring/metrics.js src/lib/monitoring/__tests__/metrics.test.js
git commit -m "feat: vehicle plugged/charging rows and home-battery metrics"
```

---

## Task 3: MetricRow — `textKey` prop

**Files:**
- Modify: `src/lib/components/monitoring/MetricRow.svelte`
- Test: `src/lib/components/monitoring/__tests__/MetricRow.test.js`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/components/monitoring/__tests__/MetricRow.test.js` (the file already mocks `svelte-i18n` so `$_(k)` returns `k`):
```js
it('renders a translated textKey instead of the value', () => {
  const { getByText, queryByText } = render(MetricRow, {
    props: { labelKey: 'monitoring.vehicle.plugged', textKey: 'monitoring.vehicle.plugged_yes', unit: '' },
  })
  expect(getByText('monitoring.vehicle.plugged_yes')).toBeInTheDocument()
  expect(queryByText('—')).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/rar/openevse-gui-nightshift && npx vitest run src/lib/components/monitoring/__tests__/MetricRow.test.js`
Expected: FAIL — `textKey` is ignored, so the value renders as `—`.

- [ ] **Step 3: Implement in `src/lib/components/monitoring/MetricRow.svelte`**

Replace the `<script>` block with:
```svelte
<script>
  import { _ } from 'svelte-i18n'

  let { labelKey, value, unit = '', textKey = '' } = $props()

  let display = $derived(
    textKey ? $_(textKey)
    : value === null || value === undefined ? '—'
    : value,
  )
</script>
```
The markup is unchanged. (`textKey` rows always pass `unit: ''`, so the unit `<span>` stays hidden for them.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/rar/openevse-gui-nightshift && npx vitest run src/lib/components/monitoring/__tests__/MetricRow.test.js`
Expected: PASS (new test + all existing MetricRow tests).

- [ ] **Step 5: Commit**

```bash
cd /home/rar/openevse-gui-nightshift
git add src/lib/components/monitoring/MetricRow.svelte src/lib/components/monitoring/__tests__/MetricRow.test.js
git commit -m "feat: MetricRow textKey prop for enum/boolean rows"
```

---

## Task 4: Monitoring route — wire the home-battery group

**Files:**
- Modify: `src/routes/Monitoring.svelte` (import block ~9-12, `groups` derived ~32-39)

No new test (route composition; `.svelte` is outside coverage). Verified manually in Task 8's `dev:mock`.

- [ ] **Step 1: Extend the metrics import**

Change the import in `src/routes/Monitoring.svelte` from:
```js
  import {
    energyMetrics, sensorMetrics, serviceMetrics, vehicleMetrics,
    showVehicle, safetyData, claimRows,
  } from '../lib/monitoring/metrics.js'
```
to:
```js
  import {
    energyMetrics, sensorMetrics, serviceMetrics, vehicleMetrics,
    showVehicle, homeBatteryMetrics, showHomeBattery, safetyData, claimRows,
  } from '../lib/monitoring/metrics.js'
```

- [ ] **Step 2: Add the group, gated by `showHomeBattery`**

In the `groups` derived array, add the home-battery entry right after the vehicle entry:
```js
  let groups = $derived([
    { group: energyMetrics($status_store), expanded: true },
    { group: sensorMetrics($status_store, $config_store, { tempUnit: $uisettings_store?.temp_unit }), expanded: false },
    ...(showVehicle($status_store, $config_store)
      ? [{ group: vehicleMetrics($status_store, $config_store), expanded: false }]
      : []),
    ...(showHomeBattery($status_store)
      ? [{ group: homeBatteryMetrics($status_store), expanded: false }]
      : []),
    { group: serviceMetrics($status_store, $config_store), expanded: false },
  ])
```

- [ ] **Step 3: Sanity-check the build**

Run: `cd /home/rar/openevse-gui-nightshift && npx vitest run src/lib/monitoring/__tests__/metrics.test.js`
Expected: PASS (no new tests; confirms imports still resolve). Full manual verification happens in Task 8.

- [ ] **Step 4: Commit**

```bash
cd /home/rar/openevse-gui-nightshift
git add src/routes/Monitoring.svelte
git commit -m "feat: show Home Battery group in Monitoring"
```

---

## Task 5: Solar page — divert HA source + Home Battery section

**Files:**
- Modify: `src/routes/settings/Solar.svelte`

Adds a `divert_data_src` selector (shown only when `ha_supported`), swaps the feed field for an HA entity field when HA is selected, and adds a Home Battery config section + read-only readout. The existing `divert_type` still selects production vs. grid.

- [ ] **Step 1: Add derived state**

In the `<script>` of `src/routes/settings/Solar.svelte`, after the existing `let activePreset = ...` line, add:
```js
  let haSupported = $derived(!!$config_store?.ha_supported)
  let divertSrc = $derived(Number($config_store?.divert_data_src ?? 0))
  let divertSrcOptions = $derived([
    { value: '0', label: $_('config.solar.data_mqtt') },
    ...(haSupported ? [{ value: '1', label: $_('config.solar.data_ha') }] : []),
  ])
```

- [ ] **Step 2: Add the data-source selector**

In the "mode" `ConfigSection`, immediately after the `config.solar.source` (divert_type) `FormField` block (the one closing at line ~81), insert:
```svelte
      {#if haSupported}
        <FormField label={$_('config.solar.data_source')} status={$ss.divert_data_src ?? 'idle'}>
          <Select
            options={divertSrcOptions}
            value={String(divertSrc)}
            onchange={(v) => form.saveField('divert_data_src', Number(v))}
          />
        </FormField>
      {/if}
```

- [ ] **Step 3: Swap the feed field by source**

Replace the existing feed block:
```svelte
      {#if divertType === 0}
        <FormField
          label={$_('config.solar.feed_production')}
          description={$_('config.solar.feed_production_desc')}
          status={$ss.mqtt_solar ?? 'idle'}
        >
          <TextInput
            value={$config_store?.mqtt_solar ?? ''}
            placeholder="topic/pv_production"
            revert={form.revert}
            onchange={(v) => form.saveField('mqtt_solar', v)}
          />
        </FormField>
      {:else}
        <FormField
          label={$_('config.solar.feed_grid')}
          description={$_('config.solar.feed_grid_desc')}
          status={$ss.mqtt_grid_ie ?? 'idle'}
        >
          <TextInput
            value={$config_store?.mqtt_grid_ie ?? ''}
            placeholder="topic/grid_ie"
            revert={form.revert}
            onchange={(v) => form.saveField('mqtt_grid_ie', v)}
          />
        </FormField>
      {/if}
```
with this version (HA entity field when `divertSrc === 1`, MQTT topic otherwise):
```svelte
      {#if divertType === 0}
        {#if divertSrc === 1}
          <FormField label={$_('config.solar.feed_solar_entity')} status={$ss.ha_solar ?? 'idle'}>
            <TextInput
              value={$config_store?.ha_solar ?? ''}
              placeholder="sensor.solar_power"
              revert={form.revert}
              onchange={(v) => form.saveField('ha_solar', v)}
            />
          </FormField>
        {:else}
          <FormField
            label={$_('config.solar.feed_production')}
            description={$_('config.solar.feed_production_desc')}
            status={$ss.mqtt_solar ?? 'idle'}
          >
            <TextInput
              value={$config_store?.mqtt_solar ?? ''}
              placeholder="topic/pv_production"
              revert={form.revert}
              onchange={(v) => form.saveField('mqtt_solar', v)}
            />
          </FormField>
        {/if}
      {:else}
        {#if divertSrc === 1}
          <FormField label={$_('config.solar.feed_grid_entity')} status={$ss.ha_grid_ie ?? 'idle'}>
            <TextInput
              value={$config_store?.ha_grid_ie ?? ''}
              placeholder="sensor.grid_power"
              revert={form.revert}
              onchange={(v) => form.saveField('ha_grid_ie', v)}
            />
          </FormField>
        {:else}
          <FormField
            label={$_('config.solar.feed_grid')}
            description={$_('config.solar.feed_grid_desc')}
            status={$ss.mqtt_grid_ie ?? 'idle'}
          >
            <TextInput
              value={$config_store?.mqtt_grid_ie ?? ''}
              placeholder="topic/grid_ie"
              revert={form.revert}
              onchange={(v) => form.saveField('mqtt_grid_ie', v)}
            />
          </FormField>
        {/if}
      {/if}
```

- [ ] **Step 4: Add the Home Battery section**

Immediately before the final `</ConfigPage>` (after the `{#if enabled}` … tuning section closes), add a section gated only by `haSupported` (independent of divert being enabled):
```svelte
  {#if haSupported}
    <ConfigSection title={$_('config.solar.home_battery')}>
      <p class="text-sm text-text-dim">{$_('config.solar.home_battery_info')}</p>
      <FormField label={$_('config.solar.battery_soc_entity')} status={$ss.ha_battery_soc ?? 'idle'}>
        <TextInput
          value={$config_store?.ha_battery_soc ?? ''}
          placeholder="sensor.home_battery_soc"
          revert={form.revert}
          onchange={(v) => form.saveField('ha_battery_soc', v)}
        />
      </FormField>
      <FormField label={$_('config.solar.battery_power_entity')} status={$ss.ha_battery_power ?? 'idle'}>
        <TextInput
          value={$config_store?.ha_battery_power ?? ''}
          placeholder="sensor.home_battery_power"
          revert={form.revert}
          onchange={(v) => form.saveField('ha_battery_power', v)}
        />
      </FormField>
      {#if $status_store?.home_battery_soc !== undefined && $status_store?.home_battery_soc !== null}
        <ReadOnlyRow label={$_('config.solar.battery_soc')} value={`${$status_store?.home_battery_soc ?? 0} %`} />
        <ReadOnlyRow label={$_('config.solar.battery_power')} value={`${$status_store?.home_battery_power ?? 0} W`} />
      {/if}
    </ConfigSection>
  {/if}
```
(`Select`, `TextInput`, `ReadOnlyRow`, `ConfigSection`, `FormField` are all already imported in this file.)

- [ ] **Step 5: Verify the suite still passes**

Run: `cd /home/rar/openevse-gui-nightshift && npm test`
Expected: PASS (no logic in `src/lib/**` changed here; this confirms nothing regressed).

- [ ] **Step 6: Commit**

```bash
cd /home/rar/openevse-gui-nightshift
git add src/routes/settings/Solar.svelte
git commit -m "feat: HA source for divert + Home Battery section on Solar page"
```

---

## Task 6: Shaper page — HA live-power source

**Files:**
- Modify: `src/routes/settings/Shaper.svelte`

- [ ] **Step 1: Import `Select` and add derived state**

In `src/routes/settings/Shaper.svelte`, add the `Select` import alongside the other UI imports:
```js
  import Select from '../../lib/components/ui/Select.svelte'
```
After `let enabled = $derived(!!$config_store?.current_shaper_enabled)`, add:
```js
  let haSupported = $derived(!!$config_store?.ha_supported)
  let shaperSrc = $derived(Number($config_store?.shaper_data_src ?? 0))
  let shaperSrcOptions = $derived([
    { value: '0', label: $_('config.shaper.data_mqtt') },
    ...(haSupported ? [{ value: '1', label: $_('config.shaper.data_ha') }] : []),
  ])
```

- [ ] **Step 2: Add the selector and swap the live-power field**

In the "settings" `ConfigSection`, replace the existing `live_topic` `FormField`:
```svelte
      <FormField label={$_('config.shaper.live_topic')} status={$ss.mqtt_live_pwr ?? 'idle'}>
        <TextInput
          value={$config_store?.mqtt_live_pwr ?? ''}
          placeholder="topic/powerload"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_live_pwr', v)}
        />
      </FormField>
```
with:
```svelte
      {#if haSupported}
        <FormField label={$_('config.shaper.data_source')} status={$ss.shaper_data_src ?? 'idle'}>
          <Select
            options={shaperSrcOptions}
            value={String(shaperSrc)}
            onchange={(v) => form.saveField('shaper_data_src', Number(v))}
          />
        </FormField>
      {/if}
      {#if shaperSrc === 1}
        <FormField label={$_('config.shaper.live_entity')} status={$ss.ha_live_pwr ?? 'idle'}>
          <TextInput
            value={$config_store?.ha_live_pwr ?? ''}
            placeholder="sensor.home_power"
            revert={form.revert}
            onchange={(v) => form.saveField('ha_live_pwr', v)}
          />
        </FormField>
      {:else}
        <FormField label={$_('config.shaper.live_topic')} status={$ss.mqtt_live_pwr ?? 'idle'}>
          <TextInput
            value={$config_store?.mqtt_live_pwr ?? ''}
            placeholder="topic/powerload"
            revert={form.revert}
            onchange={(v) => form.saveField('mqtt_live_pwr', v)}
          />
        </FormField>
      {/if}
```

- [ ] **Step 3: Verify the suite still passes**

Run: `cd /home/rar/openevse-gui-nightshift && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /home/rar/openevse-gui-nightshift
git add src/routes/settings/Shaper.svelte
git commit -m "feat: HA source for shaper live power"
```

---

## Task 7: Vehicle page — plugged-in + charging-state entities

**Files:**
- Modify: `src/routes/settings/Vehicle.svelte` (HA section, `{#if src === 4 ...}` ~246-288)

- [ ] **Step 1: Add two entity fields**

In `src/routes/settings/Vehicle.svelte`, inside the `{#if src === 4 && $config_store?.ha_supported}` `ConfigSection`, after the existing `entity_charge_limit` `FormField` (the last one, closing ~287), add:
```svelte
      <FormField label={$_('config.vehicle.entity_plugged')} status={$ss.ha_vehicle_plugged ?? 'idle'}>
        <TextInput
          value={$config_store?.ha_vehicle_plugged ?? ''}
          placeholder="binary_sensor.car_plugged_in"
          revert={form.revert}
          onchange={(v) => form.saveField('ha_vehicle_plugged', v)}
        />
      </FormField>
      <FormField label={$_('config.vehicle.entity_charging_state')} status={$ss.ha_vehicle_charging_state ?? 'idle'}>
        <TextInput
          value={$config_store?.ha_vehicle_charging_state ?? ''}
          placeholder="sensor.car_charging_state"
          revert={form.revert}
          onchange={(v) => form.saveField('ha_vehicle_charging_state', v)}
        />
      </FormField>
```
(`TextInput` and `FormField` are already imported.)

- [ ] **Step 2: Verify the suite still passes**

Run: `cd /home/rar/openevse-gui-nightshift && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /home/rar/openevse-gui-nightshift
git add src/routes/settings/Vehicle.svelte
git commit -m "feat: HA plugged-in and charging-state vehicle entities"
```

---

## Task 8: Mock fixtures — show all four feeds in `dev:mock`

**Files:**
- Modify: `dev/fixtures/config.json`
- Modify: `dev/fixtures/status.json`

Mock fixtures load once at server start, so a `dev:mock` restart is required after editing. `ha_url` is already set in `config.json` (so `ha_supported` derives true).

- [ ] **Step 1: Edit `dev/fixtures/config.json`**

Set/add these keys (enable divert + shaper so their sections render, and point everything at HA):
- `"divert_enabled": true` (was `false`)
- `"divert_type": 0` (was `-1` — production, so the `ha_solar` field shows)
- `"divert_data_src": 1`  (new)
- `"ha_solar": "sensor.solar_power"`  (new)
- `"ha_grid_ie": "sensor.grid_power"`  (new)
- `"current_shaper_enabled": true` (was `false`)
- `"shaper_data_src": 1`  (new)
- `"ha_live_pwr": "sensor.home_power"`  (new)
- `"ha_battery_soc": "sensor.home_battery_soc"`  (new)
- `"ha_battery_power": "sensor.home_battery_power"`  (new)
- `"ha_vehicle_plugged": "binary_sensor.car_plugged_in"`  (new)
- `"ha_vehicle_charging_state": "sensor.car_charging_state"`  (new)

(`vehicle_data_src` is already `4`.)

- [ ] **Step 2: Edit `dev/fixtures/status.json`**

Set/add these fields (give the existing zero-valued feeds realistic numbers and add the new status fields):
- `"solar": 3200` (was `0`)
- `"grid_ie": -1500` (was `0`)
- `"shaper_live_pwr": 4200` (was `0`)
- `"shaper_updated": true`  (so the shaper "Live data" row shows "Updating")
- `"shaper_cur": 24`
- `"divert_active": true`  (so the divert "smoothed" row shows)
- `"smoothed_available_current": 18`
- `"home_battery_soc": 82`  (new)
- `"home_battery_power": -1200`  (new — discharging)
- `"vehicle_plugged": true`  (new)
- `"vehicle_charging_state": "charging"`  (new)

- [ ] **Step 3: Validate the JSON**

Run: `cd /home/rar/openevse-gui-nightshift && node -e "require('./dev/fixtures/config.json'); require('./dev/fixtures/status.json'); console.log('json ok')"`
Expected: `json ok` (no parse error).

- [ ] **Step 4: Manual verification in `dev:mock`**

Start (or restart) the mock server: `cd /home/rar/openevse-gui-nightshift && npm run dev:mock`. In the browser confirm:
1. Settings → Solar: "Data source" = Home Assistant, a "Solar production entity" field shows `sensor.solar_power`, and a "Home Battery" section shows the two entity fields + a read-only SoC/power readout.
2. Settings → Shaper: "Data source" = Home Assistant, "Live power entity" shows `sensor.home_power`.
3. Settings → Vehicle: the HA section shows "Plugged-in entity" and "Charging state entity" fields.
4. Monitoring → Data tab: the Vehicle group shows "Plugged in: Yes" and "Charging state: Charging"; a "Home Battery" group shows "State of charge: 82 %" and "Power: -1200 W".

- [ ] **Step 5: Commit**

```bash
cd /home/rar/openevse-gui-nightshift
git add dev/fixtures/config.json dev/fixtures/status.json
git commit -m "mock: HA data sources in dev fixtures"
```

---

## Final Verification

- [ ] Run the full suite: `cd /home/rar/openevse-gui-nightshift && npm test` — all green (including `locale-parity`, `metrics`, `MetricRow`).
- [ ] Manual `dev:mock` walkthrough per Task 8 Step 4.
- [ ] Confirm backward compatibility: with `divert_data_src`/`shaper_data_src` absent (undefined → `0`), Solar/Shaper render their MQTT topic fields exactly as before.
