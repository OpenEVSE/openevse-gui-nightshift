# Config Energy Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four Energy config pages — Solar (self-production), Shaper,
EmonCMS, OhmConnect — on the existing scaffolding.

**Architecture:** Each page is a route component in `src/routes/settings/`, the only
store-aware unit, using `createConfigForm()` for per-field saves. Solar's tuning
presets are a pure module in `src/lib/config/`. Pages follow the Connectivity pattern
(`Mqtt.svelte` is the closest exemplar — toggle-gated form + read-only status).

**Tech Stack:** Svelte 5 runes, Vite 8, Tailwind 4, svelte-i18n, Vitest +
@testing-library/svelte.

**Reference:** `docs/superpowers/specs/2026-05-22-config-system-design.md` — §6 (save
model), §7.10–7.13 (the four pages).

---

## File Structure

**Create:**
- `src/lib/config/divert.js` — solar-divert tuning presets + test
- `src/routes/settings/{Solar,Shaper,Emoncms,Ohmconnect}.svelte` + `__tests__/`

**Modify:**
- `src/lib/i18n/en.json` — extend the `config` block
- `src/lib/routes.js` — point the four routes at the real components

**Conventions (carried from earlier batches):** route tests mock `svelte-i18n` (standard
stub) and `../../../lib/api/httpAPI.js`; `config_store` imports `httpAPI` from
`src/lib/api/httpAPI.js`. After an async save, assert with `vi.waitFor(...)`. The
`Select` primitive emits a **string** — for numeric/boolean fields convert in `onchange`
(`Number(v)`, `v === 'true'`) and stringify the `value` prop. `Toggle` emits a boolean.
Commit after every green step.

---

## Task 1: Solar-divert presets — `src/lib/config/divert.js`

The Solar page offers four tuning presets that each set the same four divert
parameters. This pure module holds the preset definitions and the match/lookup logic.

**Files:**
- Create: `src/lib/config/divert.js`
- Test: `src/lib/config/__tests__/divert.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/config/__tests__/divert.test.js
import { describe, it, expect } from 'vitest'
import { DIVERT_PRESETS, matchPreset, presetValues } from '../divert.js'

describe('DIVERT_PRESETS', () => {
  it('has the three named presets', () => {
    expect(DIVERT_PRESETS.map((p) => p.id)).toEqual(['default', 'no_waste', 'no_import'])
  })
})

describe('matchPreset', () => {
  it('returns the preset id when the config matches a preset', () => {
    expect(matchPreset({
      divert_attack_smoothing_time: 20, divert_decay_smoothing_time: 600,
      divert_min_charge_time: 600, divert_PV_ratio: 1.1,
    })).toBe('default')
    expect(matchPreset({
      divert_attack_smoothing_time: 300, divert_decay_smoothing_time: 20,
      divert_min_charge_time: 600, divert_PV_ratio: 1.1,
    })).toBe('no_import')
  })
  it('matches even when values are numeric strings', () => {
    expect(matchPreset({
      divert_attack_smoothing_time: '20', divert_decay_smoothing_time: '600',
      divert_min_charge_time: '600', divert_PV_ratio: '0.5',
    })).toBe('no_waste')
  })
  it('returns "custom" when nothing matches or config is missing', () => {
    expect(matchPreset({ divert_PV_ratio: 2 })).toBe('custom')
    expect(matchPreset(undefined)).toBe('custom')
  })
})

describe('presetValues', () => {
  it('returns the four params for a known preset', () => {
    expect(presetValues('no_import')).toEqual({
      divert_attack_smoothing_time: 300, divert_decay_smoothing_time: 20,
      divert_min_charge_time: 600, divert_PV_ratio: 1.1,
    })
  })
  it('returns null for an unknown id', () => {
    expect(presetValues('custom')).toBe(null)
  })
})
```

- [ ] **Step 2: Run it — expect FAIL** (`npx vitest run src/lib/config/__tests__/divert.test.js`).

- [ ] **Step 3: Implement**

```js
// src/lib/config/divert.js
// Solar-divert tuning presets. Each preset fixes the same four divert
// parameters; "custom" means the live config matches none of them.

export const DIVERT_PRESETS = [
  { id: 'default',   divert_attack_smoothing_time: 20,  divert_decay_smoothing_time: 600, divert_min_charge_time: 600, divert_PV_ratio: 1.1 },
  { id: 'no_waste',  divert_attack_smoothing_time: 20,  divert_decay_smoothing_time: 600, divert_min_charge_time: 600, divert_PV_ratio: 0.5 },
  { id: 'no_import', divert_attack_smoothing_time: 300, divert_decay_smoothing_time: 20,  divert_min_charge_time: 600, divert_PV_ratio: 1.1 },
]

const FIELDS = [
  'divert_attack_smoothing_time',
  'divert_decay_smoothing_time',
  'divert_min_charge_time',
  'divert_PV_ratio',
]

export function presetValues(id) {
  const p = DIVERT_PRESETS.find((x) => x.id === id)
  if (!p) return null
  return {
    divert_attack_smoothing_time: p.divert_attack_smoothing_time,
    divert_decay_smoothing_time: p.divert_decay_smoothing_time,
    divert_min_charge_time: p.divert_min_charge_time,
    divert_PV_ratio: p.divert_PV_ratio,
  }
}

export function matchPreset(config) {
  if (!config) return 'custom'
  for (const p of DIVERT_PRESETS) {
    if (FIELDS.every((f) => Number(config[f]) === p[f])) return p.id
  }
  return 'custom'
}
```

- [ ] **Step 4: Run it — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the solar-divert preset helper"`

---

## Task 2: Solar page — `src/routes/settings/Solar.svelte`

Spec §7.10. `divert_enabled` toggle gates the form. The MQTT feed topic shown depends
on `divert_type` (Production=0 → `mqtt_solar`; Excess=1 → `mqtt_grid_ie`). A
`SegmentedControl` picks a tuning preset; choosing a named preset saves its four
params at once.

**Files:**
- Create: `src/routes/settings/Solar.svelte`
- Test: `src/routes/settings/__tests__/Solar.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/settings/__tests__/Solar.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { status_store } from '../../../lib/stores/status.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Solar from '../Solar.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ solar: 0, grid_ie: 0, charge_rate: 0 })
})

describe('Solar page', () => {
  it('hides the form until divert is enabled', () => {
    config_store.set({ divert_enabled: false })
    const { queryByText } = render(Solar)
    expect(queryByText('config.solar.ratio')).not.toBeInTheDocument()
  })

  it('shows the production topic for divert type 0', () => {
    config_store.set({ divert_enabled: true, divert_type: 0 })
    const { getByText, queryByText } = render(Solar)
    expect(getByText('config.solar.feed_production')).toBeInTheDocument()
    expect(queryByText('config.solar.feed_grid')).not.toBeInTheDocument()
  })

  it('shows the grid topic for divert type 1', () => {
    config_store.set({ divert_enabled: true, divert_type: 1 })
    const { getByText } = render(Solar)
    expect(getByText('config.solar.feed_grid')).toBeInTheDocument()
  })

  it('saves all four params when a preset is chosen', async () => {
    config_store.set({ divert_enabled: true, divert_type: 0, divert_PV_ratio: 2 })
    const { getByText } = render(Solar)
    await fireEvent.click(getByText('config.solar.preset_no_import'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({
        divert_attack_smoothing_time: 300, divert_decay_smoothing_time: 20,
        divert_min_charge_time: 600, divert_PV_ratio: 1.1,
      }))
    })
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/routes/settings/Solar.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import { matchPreset, presetValues } from '../../lib/config/divert.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'
  import SegmentedControl from '../../lib/components/ui/SegmentedControl.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let enabled = $derived(!!$config_store?.divert_enabled)
  let divertType = $derived(Number($config_store?.divert_type ?? 0))
  let activePreset = $derived(matchPreset($config_store))

  let typeOptions = $derived([
    { value: '0', label: $_('config.solar.type_production') },
    { value: '1', label: $_('config.solar.type_excess') },
  ])
  let presetOptions = $derived([
    { value: 'default', label: $_('config.solar.preset_default') },
    { value: 'no_waste', label: $_('config.solar.preset_no_waste') },
    { value: 'no_import', label: $_('config.solar.preset_no_import') },
    { value: 'custom', label: $_('config.solar.preset_custom') },
  ])

  function applyPreset(id) {
    const values = presetValues(id)
    if (values) form.saveFields(values)
  }
</script>

<ConfigPage title={$_('config.pages.solar')}>
  <ConfigSection>
    <FormField label={$_('config.solar.enable')}>
      <Toggle
        checked={enabled}
        label={$_('config.solar.enable')}
        onchange={(v) => form.saveField('divert_enabled', v)}
      />
    </FormField>
    {#if enabled}
      <ReadOnlyRow
        label={divertType === 1 ? $_('config.solar.grid') : $_('config.solar.production')}
        value={`${divertType === 1 ? ($status_store?.grid_ie ?? 0) : ($status_store?.solar ?? 0)} W`}
      />
      <ReadOnlyRow label={$_('config.solar.charge_rate')} value={`${$status_store?.charge_rate ?? 0} A`} />
    {/if}
  </ConfigSection>

  {#if enabled}
    <ConfigSection title={$_('config.solar.mode')}>
      <FormField label={$_('config.solar.default_mode')} description={$_('config.solar.default_mode_desc')}>
        <Toggle
          checked={$config_store?.charge_mode === 'eco'}
          label={$_('config.solar.default_mode')}
          onchange={(v) => form.saveField('charge_mode', v ? 'eco' : 'fast')}
        />
      </FormField>
      <FormField label={$_('config.solar.source')} status={$ss.divert_type ?? 'idle'}>
        <Select
          options={typeOptions}
          value={String(divertType)}
          onchange={(v) => form.saveField('divert_type', Number(v))}
        />
      </FormField>
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
    </ConfigSection>

    <ConfigSection title={$_('config.solar.tuning')}>
      <FormField label={$_('config.solar.preset')}>
        <SegmentedControl
          options={presetOptions}
          value={activePreset}
          onchange={applyPreset}
        />
      </FormField>
      <FormField
        label={$_('config.solar.ratio')}
        description={$_('config.solar.ratio_desc')}
        status={$ss.divert_PV_ratio ?? 'idle'}
      >
        <NumberInput
          value={$config_store?.divert_PV_ratio ?? null}
          step={0.01}
          placeholder="1.1"
          revert={form.revert}
          onchange={(v) => form.saveField('divert_PV_ratio', v)}
        />
      </FormField>
      <FormField
        label={$_('config.solar.min_charge')}
        description={$_('config.solar.min_charge_desc')}
        status={$ss.divert_min_charge_time ?? 'idle'}
      >
        <NumberInput
          value={$config_store?.divert_min_charge_time ?? null}
          min={0}
          placeholder="600"
          revert={form.revert}
          onchange={(v) => form.saveField('divert_min_charge_time', v)}
        />
      </FormField>
      <FormField
        label={$_('config.solar.attack')}
        description={$_('config.solar.attack_desc')}
        status={$ss.divert_attack_smoothing_time ?? 'idle'}
      >
        <NumberInput
          value={$config_store?.divert_attack_smoothing_time ?? null}
          min={0}
          max={600}
          revert={form.revert}
          onchange={(v) => form.saveField('divert_attack_smoothing_time', v)}
        />
      </FormField>
      <FormField
        label={$_('config.solar.decay')}
        description={$_('config.solar.decay_desc')}
        status={$ss.divert_decay_smoothing_time ?? 'idle'}
      >
        <NumberInput
          value={$config_store?.divert_decay_smoothing_time ?? null}
          min={0}
          max={600}
          revert={form.revert}
          onchange={(v) => form.saveField('divert_decay_smoothing_time', v)}
        />
      </FormField>
    </ConfigSection>
  {/if}
</ConfigPage>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the Solar config page"`

---

## Task 3: Shaper page — `src/routes/settings/Shaper.svelte`

Spec §7.11. `current_shaper_enabled` toggle gates the form.

**Files:**
- Create: `src/routes/settings/Shaper.svelte`
- Test: `src/routes/settings/__tests__/Shaper.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/settings/__tests__/Shaper.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { status_store } from '../../../lib/stores/status.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Shaper from '../Shaper.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ shaper_updated: true, shaper_live_pwr: 0, shaper_cur: 0 })
})

describe('Shaper page', () => {
  it('hides the form until the shaper is enabled', () => {
    config_store.set({ current_shaper_enabled: false })
    const { queryByText } = render(Shaper)
    expect(queryByText('config.shaper.max_power')).not.toBeInTheDocument()
  })

  it('shows the form when the shaper is enabled', () => {
    config_store.set({ current_shaper_enabled: true })
    const { getByText } = render(Shaper)
    expect(getByText('config.shaper.max_power')).toBeInTheDocument()
  })

  it('saves the max-power field on blur', async () => {
    config_store.set({ current_shaper_enabled: true, current_shaper_max_pwr: 5000 })
    const { getByDisplayValue } = render(Shaper)
    const input = getByDisplayValue('5000')
    await fireEvent.input(input, { target: { value: '9000' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ current_shaper_max_pwr: 9000 }))
  })

  it('surfaces the write-error alert on a failed save', async () => {
    httpAPI.mockResolvedValue('error')
    config_store.set({ current_shaper_enabled: true, current_shaper_max_pwr: 5000 })
    const { getByDisplayValue } = render(Shaper)
    const input = getByDisplayValue('5000')
    await fireEvent.input(input, { target: { value: '9000' } })
    await fireEvent.blur(input)
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/routes/settings/Shaper.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let enabled = $derived(!!$config_store?.current_shaper_enabled)
</script>

<ConfigPage title={$_('config.pages.shaper')}>
  <ConfigSection>
    <FormField label={$_('config.shaper.enable')}>
      <Toggle
        checked={enabled}
        label={$_('config.shaper.enable')}
        onchange={(v) => form.saveField('current_shaper_enabled', v)}
      />
    </FormField>
    {#if enabled}
      <ReadOnlyRow
        label={$_('config.shaper.state')}
        value={$status_store?.shaper_updated ? $_('config.shaper.updated') : $_('config.shaper.stale')}
        tone={$status_store?.shaper_updated ? 'ok' : 'error'}
      />
      <ReadOnlyRow label={$_('config.shaper.live_power')} value={`${$status_store?.shaper_live_pwr ?? 0} W`} />
      <ReadOnlyRow label={$_('config.shaper.available')} value={`${$status_store?.shaper_cur ?? 0} A`} />
    {/if}
  </ConfigSection>

  {#if enabled}
    <ConfigSection title={$_('config.shaper.settings')}>
      <FormField label={$_('config.shaper.max_power')} status={$ss.current_shaper_max_pwr ?? 'idle'}>
        <NumberInput
          value={$config_store?.current_shaper_max_pwr ?? null}
          placeholder="9000"
          revert={form.revert}
          onchange={(v) => form.saveField('current_shaper_max_pwr', v)}
        />
      </FormField>
      <FormField label={$_('config.shaper.live_topic')} status={$ss.mqtt_live_pwr ?? 'idle'}>
        <TextInput
          value={$config_store?.mqtt_live_pwr ?? ''}
          placeholder="topic/powerload"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_live_pwr', v)}
        />
      </FormField>
      <FormField label={$_('config.shaper.min_pause')} status={$ss.current_shaper_min_pause_time ?? 'idle'}>
        <NumberInput
          value={$config_store?.current_shaper_min_pause_time ?? null}
          min={0}
          max={60}
          placeholder="5"
          revert={form.revert}
          onchange={(v) => form.saveField('current_shaper_min_pause_time', v)}
        />
      </FormField>
      <FormField
        label={$_('config.shaper.max_interval')}
        description={$_('config.shaper.max_interval_desc')}
        status={$ss.current_shaper_data_maxinterval ?? 'idle'}
      >
        <NumberInput
          value={$config_store?.current_shaper_data_maxinterval ?? null}
          min={10}
          max={300}
          placeholder="120"
          revert={form.revert}
          onchange={(v) => form.saveField('current_shaper_data_maxinterval', v)}
        />
      </FormField>
      <FormField
        label={$_('config.shaper.smoothing')}
        description={$_('config.shaper.smoothing_desc')}
        status={$ss.current_shaper_smoothing_time ?? 'idle'}
      >
        <NumberInput
          value={$config_store?.current_shaper_smoothing_time ?? null}
          min={0}
          max={600}
          revert={form.revert}
          onchange={(v) => form.saveField('current_shaper_smoothing_time', v)}
        />
      </FormField>
    </ConfigSection>
  {/if}
</ConfigPage>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the Shaper config page"`

---

## Task 4: EmonCMS page — `src/routes/settings/Emoncms.svelte`

Spec §7.12. `emoncms_enabled` toggle gates the form.

**Files:**
- Create: `src/routes/settings/Emoncms.svelte`
- Test: `src/routes/settings/__tests__/Emoncms.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/settings/__tests__/Emoncms.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { status_store } from '../../../lib/stores/status.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Emoncms from '../Emoncms.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ emoncms_connected: 0, packets_success: 0, packets_sent: 0 })
})

describe('EmonCMS page', () => {
  it('hides the form until emoncms is enabled', () => {
    config_store.set({ emoncms_enabled: false })
    const { queryByText } = render(Emoncms)
    expect(queryByText('config.emoncms.server')).not.toBeInTheDocument()
  })

  it('shows the form when emoncms is enabled', () => {
    config_store.set({ emoncms_enabled: true })
    const { getByText } = render(Emoncms)
    expect(getByText('config.emoncms.server')).toBeInTheDocument()
  })

  it('saves the server field on blur', async () => {
    config_store.set({ emoncms_enabled: true, emoncms_server: 'old' })
    const { getByDisplayValue } = render(Emoncms)
    const input = getByDisplayValue('old')
    await fireEvent.input(input, { target: { value: 'emoncms.org' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ emoncms_server: 'emoncms.org' }))
  })

  it('surfaces the write-error alert on a failed save', async () => {
    httpAPI.mockResolvedValue('error')
    config_store.set({ emoncms_enabled: true, emoncms_server: 'old' })
    const { getByDisplayValue } = render(Emoncms)
    const input = getByDisplayValue('old')
    await fireEvent.input(input, { target: { value: 'x' } })
    await fireEvent.blur(input)
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/routes/settings/Emoncms.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import PasswordInput from '../../lib/components/ui/PasswordInput.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let enabled = $derived(!!$config_store?.emoncms_enabled)
  let connected = $derived($status_store?.emoncms_connected === 1)
</script>

<ConfigPage title={$_('config.pages.emoncms')}>
  <ConfigSection>
    <FormField label={$_('config.emoncms.enable')}>
      <Toggle
        checked={enabled}
        label={$_('config.emoncms.enable')}
        onchange={(v) => form.saveField('emoncms_enabled', v)}
      />
    </FormField>
    {#if enabled}
      <ReadOnlyRow
        label={$_('config.connected')}
        value={connected ? $_('config.connected') : $_('config.not_connected')}
        tone={connected ? 'ok' : 'error'}
      />
      <ReadOnlyRow
        label={$_('config.emoncms.posts')}
        value={`${$status_store?.packets_success ?? 0} / ${$status_store?.packets_sent ?? 0}`}
      />
    {/if}
  </ConfigSection>

  {#if enabled}
    <ConfigSection title={$_('config.emoncms.account')}>
      <FormField
        label={$_('config.emoncms.server')}
        description={$_('config.emoncms.server_desc')}
        status={$ss.emoncms_server ?? 'idle'}
      >
        <TextInput
          value={$config_store?.emoncms_server ?? ''}
          placeholder="emoncms.org"
          revert={form.revert}
          onchange={(v) => form.saveField('emoncms_server', v)}
        />
      </FormField>
      <FormField label={$_('config.emoncms.node')} status={$ss.emoncms_node ?? 'idle'}>
        <TextInput
          value={$config_store?.emoncms_node ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('emoncms_node', v)}
        />
      </FormField>
      <FormField label={$_('config.emoncms.apikey')} status={$ss.emoncms_apikey ?? 'idle'}>
        <PasswordInput
          value={$config_store?.emoncms_apikey ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('emoncms_apikey', v)}
        />
      </FormField>
    </ConfigSection>
  {/if}
</ConfigPage>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the EmonCMS config page"`

---

## Task 5: OhmConnect page — `src/routes/settings/Ohmconnect.svelte`

Spec §7.13. `ohm_enabled` toggle gates a single key field.

**Files:**
- Create: `src/routes/settings/Ohmconnect.svelte`
- Test: `src/routes/settings/__tests__/Ohmconnect.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/settings/__tests__/Ohmconnect.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { status_store } from '../../../lib/stores/status.js'
import Ohmconnect from '../Ohmconnect.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ ohm_hour: 'NotConnected' })
})

describe('OhmConnect page', () => {
  it('hides the key field until ohm is enabled', () => {
    config_store.set({ ohm_enabled: false })
    const { queryByText } = render(Ohmconnect)
    expect(queryByText('config.ohmconnect.key')).not.toBeInTheDocument()
  })

  it('shows the key field when ohm is enabled', () => {
    config_store.set({ ohm_enabled: true, ohm: '' })
    const { getByText } = render(Ohmconnect)
    expect(getByText('config.ohmconnect.key')).toBeInTheDocument()
  })

  it('saves the enable toggle', async () => {
    config_store.set({ ohm_enabled: false })
    const { getByRole } = render(Ohmconnect)
    await fireEvent.click(getByRole('switch'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ ohm_enabled: true }))
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/routes/settings/Ohmconnect.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import PasswordInput from '../../lib/components/ui/PasswordInput.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let enabled = $derived(!!$config_store?.ohm_enabled)
</script>

<ConfigPage title={$_('config.pages.ohmconnect')}>
  <ConfigSection>
    <FormField label={$_('config.ohmconnect.enable')}>
      <Toggle
        checked={enabled}
        label={$_('config.ohmconnect.enable')}
        onchange={(v) => form.saveField('ohm_enabled', v)}
      />
    </FormField>
    {#if enabled}
      <ReadOnlyRow
        label={$_('config.ohmconnect.hour')}
        value={$status_store?.ohm_hour}
        tone={$status_store?.ohm_hour === 'NotConnected' ? 'error' : 'ok'}
      />
    {/if}
  </ConfigSection>

  {#if enabled}
    <ConfigSection>
      <FormField
        label={$_('config.ohmconnect.key')}
        description={$_('config.ohmconnect.key_desc')}
        status={$ss.ohm ?? 'idle'}
      >
        <PasswordInput
          value={$config_store?.ohm ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('ohm', v)}
        />
      </FormField>
    </ConfigSection>
  {/if}
</ConfigPage>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the OhmConnect config page"`

---

## Task 6: i18n strings + route wiring

**Files:**
- Modify: `src/lib/i18n/en.json`, `src/lib/routes.js`

- [ ] **Step 1: Extend the `config` object in `en.json`** with these sub-objects
(alongside all existing keys — remove nothing):

```json
"solar": {
  "enable": "Enable solar divert",
  "production": "Solar production",
  "grid": "Grid import/export",
  "charge_rate": "Charge rate",
  "mode": "Divert mode",
  "default_mode": "Default to eco mode on power-up",
  "default_mode_desc": "Eco follows available solar; fast charges at full rate.",
  "source": "Monitor",
  "type_production": "Solar production",
  "type_excess": "Grid excess",
  "feed_production": "Production feed topic",
  "feed_production_desc": "MQTT topic publishing solar production in watts.",
  "feed_grid": "Grid feed topic",
  "feed_grid_desc": "MQTT topic publishing grid import/export in watts.",
  "tuning": "Tuning",
  "preset": "Preset",
  "preset_default": "Default",
  "preset_no_waste": "No waste",
  "preset_no_import": "No import",
  "preset_custom": "Custom",
  "ratio": "PV power ratio",
  "ratio_desc": "Scales how aggressively production drives the charge rate.",
  "min_charge": "Minimum charge time",
  "min_charge_desc": "Seconds to keep charging once started.",
  "attack": "Smoothing — attack",
  "attack_desc": "Seconds to react to falling available power.",
  "decay": "Smoothing — decay",
  "decay_desc": "Seconds to react to rising available power."
},
"shaper": {
  "enable": "Enable load shaper",
  "state": "Live data",
  "updated": "Updating",
  "stale": "Stale — no recent data",
  "live_power": "Live power load",
  "available": "Available current",
  "settings": "Settings",
  "max_power": "Maximum power allowed",
  "live_topic": "Live power topic",
  "min_pause": "Minimum pause time",
  "max_interval": "Maximum data interval",
  "max_interval_desc": "Failsafe if no live data arrives within this many seconds.",
  "smoothing": "Input smoothing",
  "smoothing_desc": "Filter time constant for the live power reading."
},
"emoncms": {
  "enable": "Enable EmonCMS",
  "posts": "Posts (ok / sent)",
  "account": "Account",
  "server": "EmonCMS server",
  "server_desc": "e.g. emoncms.org",
  "node": "Node",
  "apikey": "Write API key"
},
"ohmconnect": {
  "enable": "Enable OhmConnect",
  "hour": "Ohm hour",
  "key": "Ohm key",
  "key_desc": "Your OhmConnect account key."
}
```

Validate the file is parseable JSON.

- [ ] **Step 2: Wire the routes** — in `src/lib/routes.js`, add four imports and four
override assignments after the placeholder loop (alongside the earlier batches'
overrides):

```js
import Solar from '../routes/settings/Solar.svelte'
import Shaper from '../routes/settings/Shaper.svelte'
import Emoncms from '../routes/settings/Emoncms.svelte'
import Ohmconnect from '../routes/settings/Ohmconnect.svelte'
```

```js
routes['/settings/solar'] = Solar
routes['/settings/shaper'] = Shaper
routes['/settings/emoncms'] = Emoncms
routes['/settings/ohmconnect'] = Ohmconnect
```

- [ ] **Step 3: Verify** — `npm test` green; `npm run build` succeeds, assets gzipped;
`en.json` valid JSON.
- [ ] **Step 4: Commit** — `git commit -m "Wire the Energy config pages and i18n"`

---

## Verification gate (before merge)

- [ ] `npm test` — all tests pass.
- [ ] `npm run build` — succeeds; all `dist/assets` JS/CSS gzipped (except `sw.js`).
- [ ] Playwright visual check — `npm run dev:mock`, visit `/#/settings/solar`,
      `/shaper`, `/emoncms`, `/ohmconnect`. Confirm fields render, toggle-gated and
      `divert_type`-dependent sections work, no console/page errors.

## On completion

Hand off to `superpowers:finishing-a-development-branch` to merge `config-energy` to
`main`. Then proceed to the System batch.
