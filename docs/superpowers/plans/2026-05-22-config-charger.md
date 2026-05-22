# Config Charger Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the five Charger config pages — EVSE, Safety, Time, RFID, Vehicle — on
the Foundation + Connectivity scaffolding.

**Architecture:** Each page is a route component in `src/routes/settings/`, the only
store-aware unit, using `createConfigForm()` for per-field saves. Pure logic (RFID tag
CSV parsing) lives in `src/lib/config/`. Pages follow the Connectivity pages' pattern
exactly — Network/Mqtt are the exemplars.

**Tech Stack:** Svelte 5 runes, Vite 8, Tailwind 4, svelte-i18n, Vitest +
@testing-library/svelte.

**Reference:** `docs/superpowers/specs/2026-05-22-config-system-design.md` — §6 (save
model), §7.5–7.9 (the five pages), Decisions §11.2 (`max_current_hard` read-only),
§11.4 (Tesla OAuth deferred).

---

## File Structure

**Create:**
- `src/lib/config/rfid.js` — RFID tag CSV parse/serialise + test
- `src/routes/settings/{Evse,Safety,Time,Rfid,Vehicle}.svelte` + their `__tests__/`
- `src/lib/config/zones.json` — **already vendored** (the POSIX timezone DB, 447 zones,
  format `{ "America/New_York": "EST5EDT,M3.2.0,M11.1.0", ... }`). Do not regenerate.

**Modify:**
- `src/lib/i18n/en.json` — extend the `config` block
- `src/lib/routes.js` — point the five routes at the real components
- `dev/mock-plugin.js` — add a `GET /rfid/add` route

**Key gotcha — the `Select` primitive emits a STRING.** `Select`'s `onchange` gives
`e.currentTarget.value`, always a string. For boolean/number config fields, convert in
the page's `onchange` handler (`v === 'true'`, `Number(v)`) and stringify the `value`
prop (`String(...)`). Plain-string fields need no conversion. Toggle and Slider emit a
boolean / Number respectively — no conversion needed there.

Route tests mock `svelte-i18n` (standard stub) and `../../../lib/api/httpAPI.js`. After
an async save, assertions on `uistates_store`/store state use `vi.waitFor(...)`. Commit
after every green step.

---

## Task 1: RFID tag helper — `src/lib/config/rfid.js`

The device stores registered RFID tags as one comma-separated string in
`config.rfid_storage`. This module parses and serialises that.

**Files:**
- Create: `src/lib/config/rfid.js`
- Test: `src/lib/config/__tests__/rfid.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/config/__tests__/rfid.test.js
import { describe, it, expect } from 'vitest'
import { parseTags, serializeTags, addTag, removeTag } from '../rfid.js'

describe('parseTags', () => {
  it('splits a comma-separated string, trimming blanks', () => {
    expect(parseTags('AA,BB,CC')).toEqual(['AA', 'BB', 'CC'])
    expect(parseTags('AA, BB ,')).toEqual(['AA', 'BB'])
  })
  it('returns an empty array for empty / missing input', () => {
    expect(parseTags('')).toEqual([])
    expect(parseTags(undefined)).toEqual([])
    expect(parseTags(null)).toEqual([])
  })
})

describe('serializeTags', () => {
  it('joins an array with commas', () => {
    expect(serializeTags(['AA', 'BB'])).toBe('AA,BB')
    expect(serializeTags([])).toBe('')
  })
})

describe('addTag', () => {
  it('appends a new tag', () => {
    expect(addTag(['AA'], 'BB')).toEqual(['AA', 'BB'])
  })
  it('does not duplicate an existing tag', () => {
    expect(addTag(['AA', 'BB'], 'AA')).toEqual(['AA', 'BB'])
  })
})

describe('removeTag', () => {
  it('drops the named tag', () => {
    expect(removeTag(['AA', 'BB', 'CC'], 'BB')).toEqual(['AA', 'CC'])
  })
  it('is a no-op when the tag is absent', () => {
    expect(removeTag(['AA'], 'ZZ')).toEqual(['AA'])
  })
})
```

- [ ] **Step 2: Run it — expect FAIL** (`npx vitest run src/lib/config/__tests__/rfid.test.js`).

- [ ] **Step 3: Implement**

```js
// src/lib/config/rfid.js
// The device keeps registered RFID tags as one comma-separated string in
// config.rfid_storage. These helpers convert to/from a tag array.

export function parseTags(csv) {
  if (!csv || typeof csv !== 'string') return []
  return csv
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '')
}

export function serializeTags(tags) {
  return (tags ?? []).join(',')
}

export function addTag(tags, tag) {
  return tags.includes(tag) ? tags : [...tags, tag]
}

export function removeTag(tags, tag) {
  return tags.filter((t) => t !== tag)
}
```

- [ ] **Step 4: Run it — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the RFID tag-storage helper"`

---

## Task 2: Safety page — `src/routes/settings/Safety.svelte`

Spec §7.6. Six safety-check toggles, three read-only fault counters, a warning banner
when not every check is enabled.

**Files:**
- Create: `src/routes/settings/Safety.svelte`
- Test: `src/routes/settings/__tests__/Safety.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/settings/__tests__/Safety.test.js
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
import { uistates_store } from '../../../lib/stores/uistates.js'
import Safety from '../Safety.svelte'

const ALL_ON = {
  gfci_check: true, ground_check: true, relay_check: true,
  temp_check: true, diode_check: true, vent_check: true,
}

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ gfcicount: 0, nogndcount: 0, stuckcount: 0 })
})

describe('Safety page', () => {
  it('shows the warning banner when a check is off', () => {
    config_store.set({ ...ALL_ON, vent_check: false })
    const { getByText } = render(Safety)
    expect(getByText('config.safety.warning')).toBeInTheDocument()
  })

  it('hides the warning banner when every check is on', () => {
    config_store.set({ ...ALL_ON })
    const { queryByText } = render(Safety)
    expect(queryByText('config.safety.warning')).not.toBeInTheDocument()
  })

  it('shows the fault counters', () => {
    config_store.set({ ...ALL_ON })
    status_store.set({ gfcicount: 3, nogndcount: 0, stuckcount: 1 })
    const { getByText } = render(Safety)
    expect(getByText('3')).toBeInTheDocument()
    expect(getByText('1')).toBeInTheDocument()
  })

  it('saves a check toggle on change', async () => {
    config_store.set({ ...ALL_ON })
    const { getAllByRole } = render(Safety)
    await fireEvent.click(getAllByRole('switch')[0])
    expect(httpAPI).toHaveBeenCalled()
    const [, , body] = httpAPI.mock.calls[0]
    expect(body).toBe(JSON.stringify({ gfci_check: false }))
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/routes/settings/Safety.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'

  const form = createConfigForm()

  const CHECKS = [
    'gfci_check', 'ground_check', 'relay_check',
    'temp_check', 'diode_check', 'vent_check',
  ]

  let allOn = $derived(CHECKS.every((c) => !!$config_store?.[c]))
</script>

<ConfigPage title={$_('config.pages.safety')}>
  {#if !allOn}
    <div class="mb-4 rounded-xl border border-warning/40 bg-surface-2 p-3 text-sm text-warning">
      {$_('config.safety.warning')}
    </div>
  {/if}

  <ConfigSection title={$_('config.safety.checks')}>
    {#each CHECKS as check}
      <FormField label={$_('config.safety.' + check)}>
        <Toggle
          checked={!!$config_store?.[check]}
          label={$_('config.safety.' + check)}
          onchange={(v) => form.saveField(check, v)}
        />
      </FormField>
    {/each}
  </ConfigSection>

  <ConfigSection title={$_('config.safety.faults')}>
    <ReadOnlyRow
      label={$_('config.safety.gfci_count')}
      value={$status_store?.gfcicount}
      tone={$status_store?.gfcicount ? 'warn' : 'default'}
    />
    <ReadOnlyRow
      label={$_('config.safety.noground_count')}
      value={$status_store?.nogndcount}
      tone={$status_store?.nogndcount ? 'warn' : 'default'}
    />
    <ReadOnlyRow
      label={$_('config.safety.stuck_count')}
      value={$status_store?.stuckcount}
      tone={$status_store?.stuckcount ? 'warn' : 'default'}
    />
  </ConfigSection>
</ConfigPage>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the Safety config page"`

---

## Task 3: EVSE page — `src/routes/settings/Evse.svelte`

Spec §7.5. `max_current_hard` is read-only (Decision §11.2). `default_state`,
`is_threephase`, `led_brightness` render only when the device reports them.

**Files:**
- Create: `src/routes/settings/Evse.svelte`
- Test: `src/routes/settings/__tests__/Evse.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/settings/__tests__/Evse.test.js
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
import Evse from '../Evse.svelte'

const BASE = {
  max_current_soft: 24, max_current_hard: 32, min_current_hard: 6,
  scheduler_start_window: 0, scale: 220, offset: 0, service: 0,
  pause_uses_disabled: false,
}

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
})

describe('EVSE page', () => {
  it('renders the max-current slider', () => {
    config_store.set({ ...BASE })
    const { getByRole } = render(Evse)
    expect(getByRole('slider')).toBeInTheDocument()
  })

  it('saves the soft current limit when the slider changes', async () => {
    config_store.set({ ...BASE })
    const { getByRole } = render(Evse)
    const slider = getByRole('slider')
    await fireEvent.change(slider, { target: { value: '16' } })
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ max_current_soft: 16 }))
  })

  it('shows the three-phase select only when the device reports it', () => {
    config_store.set({ ...BASE })
    const { queryByText, rerender } = render(Evse)
    expect(queryByText('config.evse.threephase')).not.toBeInTheDocument()
    config_store.set({ ...BASE, is_threephase: false })
    return rerender({})
  })

  it('saves the service level as a number', async () => {
    config_store.set({ ...BASE })
    const { getAllByRole } = render(Evse)
    // service is the last <select> on the page
    const selects = getAllByRole('combobox')
    await fireEvent.change(selects[selects.length - 1], { target: { value: '2' } })
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ service: 2 }))
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/routes/settings/Evse.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import Slider from '../../lib/components/ui/Slider.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let boolOptions = $derived([
    { value: 'false', label: $_('config.evse.disabled') },
    { value: 'true', label: $_('config.evse.active') },
  ])
  let phaseOptions = $derived([
    { value: 'false', label: $_('config.evse.singlephase') },
    { value: 'true', label: $_('config.evse.threephase_yes') },
  ])
  let serviceOptions = $derived([
    { value: '0', label: $_('config.evse.service_auto') },
    { value: '1', label: $_('config.evse.service_l1') },
    { value: '2', label: $_('config.evse.service_l2') },
  ])
</script>

<ConfigPage title={$_('config.pages.evse')}>
  <ConfigSection title={$_('config.evse.current')}>
    <FormField
      label={$_('config.evse.maxcurrent')}
      description={`${$config_store?.max_current_soft ?? ''} A`}
      status={$ss.max_current_soft ?? 'idle'}
    >
      <Slider
        min={$config_store?.min_current_hard ?? 6}
        max={$config_store?.max_current_hard ?? 32}
        value={$config_store?.max_current_soft ?? 6}
        onchange={(v) => form.saveField('max_current_soft', v)}
      />
    </FormField>
    <ReadOnlyRow
      label={$_('config.evse.maxcurrent_hard')}
      value={$config_store?.max_current_hard != null
        ? `${$config_store.max_current_hard} A`
        : ''}
    />
  </ConfigSection>

  <ConfigSection title={$_('config.evse.behaviour')}>
    {#if $config_store?.default_state !== undefined}
      <FormField label={$_('config.evse.defaultstate')} status={$ss.default_state ?? 'idle'}>
        <Select
          options={boolOptions}
          value={String(!!$config_store?.default_state)}
          onchange={(v) => form.saveField('default_state', v === 'true')}
        />
      </FormField>
    {/if}
    {#if $config_store?.is_threephase !== undefined}
      <FormField label={$_('config.evse.threephase')} status={$ss.is_threephase ?? 'idle'}>
        <Select
          options={phaseOptions}
          value={String(!!$config_store?.is_threephase)}
          onchange={(v) => form.saveField('is_threephase', v === 'true')}
        />
      </FormField>
    {/if}
    <FormField label={$_('config.evse.service')} status={$ss.service ?? 'idle'}>
      <Select
        options={serviceOptions}
        value={String($config_store?.service ?? 0)}
        onchange={(v) => form.saveField('service', Number(v))}
      />
    </FormField>
    <FormField label={$_('config.evse.pause_mode')}>
      <Toggle
        checked={!!$config_store?.pause_uses_disabled}
        label={$_('config.evse.pause_mode')}
        onchange={(v) => form.saveField('pause_uses_disabled', v)}
      />
    </FormField>
    <FormField
      label={$_('config.evse.start_window')}
      description={$_('config.evse.start_window_desc')}
      status={$ss.scheduler_start_window ?? 'idle'}
    >
      <NumberInput
        value={$config_store?.scheduler_start_window ?? 0}
        min={0}
        max={3600}
        revert={form.revert}
        onchange={(v) => form.saveField('scheduler_start_window', v)}
      />
    </FormField>
    {#if $config_store?.led_brightness !== undefined}
      <FormField
        label={$_('config.evse.led_brightness')}
        description={`${$config_store?.led_brightness ?? ''}`}
        status={$ss.led_brightness ?? 'idle'}
      >
        <Slider
          min={0}
          max={255}
          value={$config_store?.led_brightness ?? 0}
          onchange={(v) => form.saveField('led_brightness', v)}
        />
      </FormField>
    {/if}
  </ConfigSection>

  <ConfigSection title={$_('config.evse.sensor')}>
    <FormField label={$_('config.evse.scale')} status={$ss.scale ?? 'idle'}>
      <NumberInput
        value={$config_store?.scale ?? 0}
        revert={form.revert}
        onchange={(v) => form.saveField('scale', v)}
      />
    </FormField>
    <FormField label={$_('config.evse.offset')} status={$ss.offset ?? 'idle'}>
      <NumberInput
        value={$config_store?.offset ?? 0}
        revert={form.revert}
        onchange={(v) => form.saveField('offset', v)}
      />
    </FormField>
  </ConfigSection>
</ConfigPage>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the EVSE config page"`

---

## Task 4: Time page — `src/routes/settings/Time.svelte`

Spec §7.7. Time source (Manual / NTP), NTP host, timezone selector. The timezone DB
is the vendored `src/lib/config/zones.json`; `createTzObj` (in `src/lib/utils.js`)
turns it into `{name, value}` options. Setting the device clock manually POSTs to
`/time`.

**Files:**
- Create: `src/routes/settings/Time.svelte`
- Test: `src/routes/settings/__tests__/Time.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/settings/__tests__/Time.test.js
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
import Time from '../Time.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ time: '2026-05-22T10:00:00Z' })
})

describe('Time page', () => {
  it('shows the NTP host field in NTP mode', () => {
    config_store.set({ sntp_enabled: true, sntp_hostname: 'pool.ntp.org', time_zone: 'UTC|UTC0' })
    const { getByText } = render(Time)
    expect(getByText('config.time.ntp_host')).toBeInTheDocument()
  })

  it('hides the NTP host field in manual mode', () => {
    config_store.set({ sntp_enabled: false, time_zone: 'UTC|UTC0' })
    const { queryByText } = render(Time)
    expect(queryByText('config.time.ntp_host')).not.toBeInTheDocument()
  })

  it('shows the set-clock button in manual mode', () => {
    config_store.set({ sntp_enabled: false, time_zone: 'UTC|UTC0' })
    const { getByText } = render(Time)
    expect(getByText('config.time.set_now')).toBeInTheDocument()
  })

  it('posts to /time when the set-clock button is clicked', async () => {
    config_store.set({ sntp_enabled: false, time_zone: 'UTC|UTC0' })
    const { getByText } = render(Time)
    await fireEvent.click(getByText('config.time.set_now'))
    expect(httpAPI).toHaveBeenCalled()
    expect(httpAPI.mock.calls[0][1]).toBe('/time')
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/routes/settings/Time.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import { serialQueue } from '../../lib/queue.js'
  import { showWriteError } from '../../lib/alerts.js'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import { createTzObj } from '../../lib/utils.js'
  import zones from '../../lib/config/zones.json'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import Button from '../../lib/components/ui/Button.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  const tzOptions = createTzObj(zones).map((z) => ({ value: z.value, label: z.name }))
  const sourceOptions = [
    { value: 'manual', label: $_('config.time.manual') },
    { value: 'ntp', label: $_('config.time.ntp') },
  ]

  let isNtp = $derived(!!$config_store?.sntp_enabled)
  let busy = $state(false)

  async function setClockNow() {
    if (busy) return
    busy = true
    try {
      const body = JSON.stringify({
        sntp_enabled: false,
        time: new Date().toISOString(),
        time_zone: $config_store?.time_zone,
      })
      const res = await serialQueue.add(() => httpAPI('POST', '/time', body))
      if (!res || res === 'error' || res.msg !== 'done') showWriteError()
    } finally {
      busy = false
    }
  }
</script>

<ConfigPage title={$_('config.pages.time')}>
  <ConfigSection title={$_('config.time.status')}>
    <ReadOnlyRow label={$_('config.time.device_time')} value={$status_store?.time} />
  </ConfigSection>

  <ConfigSection>
    <FormField label={$_('config.time.source')} status={$ss.sntp_enabled ?? 'idle'}>
      <Select
        options={sourceOptions}
        value={isNtp ? 'ntp' : 'manual'}
        onchange={(v) => form.saveField('sntp_enabled', v === 'ntp')}
      />
    </FormField>

    {#if isNtp}
      <FormField label={$_('config.time.ntp_host')} status={$ss.sntp_hostname ?? 'idle'}>
        <TextInput
          value={$config_store?.sntp_hostname ?? ''}
          placeholder="pool.ntp.org"
          revert={form.revert}
          onchange={(v) => form.saveField('sntp_hostname', v)}
        />
      </FormField>
    {:else}
      <FormField label={$_('config.time.set_clock')} description={$_('config.time.set_clock_desc')}>
        <Button label={$_('config.time.set_now')} variant="ghost" disabled={busy} onclick={setClockNow} />
      </FormField>
    {/if}

    <FormField label={$_('config.time.timezone')} status={$ss.time_zone ?? 'idle'}>
      <Select
        options={tzOptions}
        value={$config_store?.time_zone ?? ''}
        onchange={(v) => form.saveField('time_zone', v)}
      />
    </FormField>
  </ConfigSection>
</ConfigPage>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the Time config page"`

---

## Task 5: RFID page — `src/routes/settings/Rfid.svelte`

Spec §7.8. `rfid_enabled` toggle gates a tag manager. "Scan" calls `GET /rfid/add`;
a scanned UID (`status.rfid_input`) can be registered or removed. Tags live in
`config.rfid_storage` as a CSV string (Task 1's `rfid.js`).

**Decision:** "Remove all" clears `rfid_storage` only — it does **not** disable RFID
(v2 also flipped `rfid_enabled` off, which is surprising; v3 drops that). Recorded here.

**Files:**
- Create: `src/routes/settings/Rfid.svelte`
- Test: `src/routes/settings/__tests__/Rfid.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/settings/__tests__/Rfid.test.js
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
import { uistates_store } from '../../../lib/stores/uistates.js'
import Rfid from '../Rfid.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ rfid_input: '' })
})

describe('RFID page', () => {
  it('hides the tag manager until rfid is enabled', () => {
    config_store.set({ rfid_enabled: false, rfid_storage: '' })
    const { queryByText } = render(Rfid)
    expect(queryByText('config.rfid.scan')).not.toBeInTheDocument()
  })

  it('shows the scan button when rfid is enabled', () => {
    config_store.set({ rfid_enabled: true, rfid_storage: '' })
    const { getByText } = render(Rfid)
    expect(getByText('config.rfid.scan')).toBeInTheDocument()
  })

  it('lists registered tags', () => {
    config_store.set({ rfid_enabled: true, rfid_storage: 'AA11,BB22' })
    const { getByText } = render(Rfid)
    expect(getByText('AA11')).toBeInTheDocument()
    expect(getByText('BB22')).toBeInTheDocument()
  })

  it('calls the scan endpoint when Scan is clicked', async () => {
    config_store.set({ rfid_enabled: true, rfid_storage: '' })
    const { getByText } = render(Rfid)
    await fireEvent.click(getByText('config.rfid.scan'))
    expect(httpAPI).toHaveBeenCalledWith('GET', '/rfid/add', null, 'txt', 60000)
  })

  it('registers a freshly scanned tag', async () => {
    config_store.set({ rfid_enabled: true, rfid_storage: 'AA11' })
    status_store.set({ rfid_input: 'CC33' })
    const { getByText } = render(Rfid)
    await fireEvent.click(getByText('config.rfid.register'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ rfid_storage: 'AA11,CC33' }))
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/routes/settings/Rfid.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { uistates_store } from '../../lib/stores/uistates.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import { serialQueue } from '../../lib/queue.js'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import { parseTags, serializeTags, addTag, removeTag } from '../../lib/config/rfid.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'
  import Button from '../../lib/components/ui/Button.svelte'
  import IconButton from '../../lib/components/ui/IconButton.svelte'

  const form = createConfigForm()

  let enabled = $derived(!!$config_store?.rfid_enabled)
  let tags = $derived(parseTags($config_store?.rfid_storage))
  let scanned = $derived($status_store?.rfid_input ?? '')
  let scanWaiting = $derived($uistates_store?.rfid_waiting ?? 0)
  let alreadyRegistered = $derived(scanned !== '' && tags.includes(scanned))

  function scan() {
    httpAPI('GET', '/rfid/add', null, 'txt', 60000)
  }
  function saveTags(next) {
    return form.saveField('rfid_storage', serializeTags(next))
  }
  function register() {
    if (scanned) saveTags(addTag(tags, scanned))
  }
  function remove(tag) {
    saveTags(removeTag(tags, tag))
  }
  function removeAll() {
    saveTags([])
  }
</script>

<ConfigPage title={$_('config.pages.rfid')}>
  <ConfigSection>
    <FormField label={$_('config.rfid.enable')}>
      <Toggle
        checked={enabled}
        label={$_('config.rfid.enable')}
        onchange={(v) => form.saveField('rfid_enabled', v)}
      />
    </FormField>
  </ConfigSection>

  {#if enabled}
    <ConfigSection title={$_('config.rfid.manage')}>
      <div class="flex flex-col items-center gap-2 py-2">
        <Button
          label={scanWaiting > 0 ? String(scanWaiting) : $_('config.rfid.scan')}
          variant="ghost"
          disabled={scanWaiting > 0}
          onclick={scan}
        />
        {#if scanWaiting > 0}
          <p class="text-xs text-text-dim">{$_('config.rfid.place_tag')}</p>
        {:else if scanned}
          <p class="text-sm text-text">{$_('config.rfid.uid')}: <span class="font-mono">{scanned}</span></p>
          {#if alreadyRegistered}
            <p class="text-xs text-text-dim">{$_('config.rfid.already')}</p>
          {:else}
            <Button label={$_('config.rfid.register')} onclick={register} />
          {/if}
        {/if}
      </div>
    </ConfigSection>

    {#if tags.length > 0}
      <ConfigSection title={$_('config.rfid.registered')}>
        {#each tags as tag}
          <div class="flex items-center justify-between py-2 text-sm">
            <span class="font-mono text-text">{tag}</span>
            <IconButton icon="mdi:trash-can-outline" label={$_('config.rfid.remove')} onclick={() => remove(tag)} />
          </div>
        {/each}
        <div class="mt-2">
          <Button label={$_('config.rfid.remove_all')} variant="ghost" onclick={removeAll} />
        </div>
      </ConfigSection>
    {/if}
  {/if}
</ConfigPage>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the RFID config page"`

---

## Task 6: Vehicle page — `src/routes/settings/Vehicle.svelte`

Spec §7.9 + Decision §11.4 (Tesla OAuth deferred — token fields only). `vehicle_data_src`
selects the integration; mode-specific fields render below.

**Files:**
- Create: `src/routes/settings/Vehicle.svelte`
- Test: `src/routes/settings/__tests__/Vehicle.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/settings/__tests__/Vehicle.test.js
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
import Vehicle from '../Vehicle.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
})

describe('Vehicle page', () => {
  it('shows MQTT topic fields when the source is MQTT', () => {
    config_store.set({ vehicle_data_src: 2 })
    const { getByText } = render(Vehicle)
    expect(getByText('config.vehicle.topic_soc')).toBeInTheDocument()
  })

  it('shows Tesla token fields when the source is Tesla', () => {
    config_store.set({ vehicle_data_src: 1 })
    const { getByText } = render(Vehicle)
    expect(getByText('config.vehicle.access_token')).toBeInTheDocument()
  })

  it('shows the HTTP info block when the source is HTTP', () => {
    config_store.set({ vehicle_data_src: 3 })
    const { getByText } = render(Vehicle)
    expect(getByText('config.vehicle.http_info')).toBeInTheDocument()
  })

  it('shows no integration fields when the source is None', () => {
    config_store.set({ vehicle_data_src: 0 })
    const { queryByText } = render(Vehicle)
    expect(queryByText('config.vehicle.topic_soc')).not.toBeInTheDocument()
    expect(queryByText('config.vehicle.access_token')).not.toBeInTheDocument()
  })

  it('saves the data source as a number', async () => {
    config_store.set({ vehicle_data_src: 0 })
    const { getByRole } = render(Vehicle)
    await fireEvent.change(getByRole('combobox'), { target: { value: '2' } })
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ vehicle_data_src: 2 }))
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/routes/settings/Vehicle.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import PasswordInput from '../../lib/components/ui/PasswordInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let src = $derived(Number($config_store?.vehicle_data_src ?? 0))

  let srcOptions = $derived([
    { value: '0', label: $_('config.vehicle.src_none') },
    { value: '1', label: $_('config.vehicle.src_tesla') },
    { value: '2', label: $_('config.vehicle.src_mqtt') },
    { value: '3', label: $_('config.vehicle.src_http') },
  ])
  let unitOptions = $derived([
    { value: 'false', label: $_('config.vehicle.km') },
    { value: 'true', label: $_('config.vehicle.miles') },
  ])
</script>

<ConfigPage title={$_('config.pages.vehicle')}>
  <ConfigSection>
    <FormField label={$_('config.vehicle.source')} status={$ss.vehicle_data_src ?? 'idle'}>
      <Select
        options={srcOptions}
        value={String(src)}
        onchange={(v) => form.saveField('vehicle_data_src', Number(v))}
      />
    </FormField>
  </ConfigSection>

  {#if src === 1}
    <ConfigSection title={$_('config.vehicle.src_tesla')}>
      <p class="mb-1 text-xs text-text-dim">{$_('config.vehicle.tesla_note')}</p>
      <FormField label={$_('config.vehicle.range_unit')} status={$ss.mqtt_vehicle_range_miles ?? 'idle'}>
        <Select
          options={unitOptions}
          value={String(!!$config_store?.mqtt_vehicle_range_miles)}
          onchange={(v) => form.saveField('mqtt_vehicle_range_miles', v === 'true')}
        />
      </FormField>
      <FormField label={$_('config.vehicle.access_token')} status={$ss.tesla_access_token ?? 'idle'}>
        <PasswordInput
          value={$config_store?.tesla_access_token ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('tesla_access_token', v)}
        />
      </FormField>
      <FormField label={$_('config.vehicle.refresh_token')} status={$ss.tesla_refresh_token ?? 'idle'}>
        <PasswordInput
          value={$config_store?.tesla_refresh_token ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('tesla_refresh_token', v)}
        />
      </FormField>
    </ConfigSection>
  {:else if src === 2}
    <ConfigSection title={$_('config.vehicle.src_mqtt')}>
      <FormField label={$_('config.vehicle.range_unit')} status={$ss.mqtt_vehicle_range_miles ?? 'idle'}>
        <Select
          options={unitOptions}
          value={String(!!$config_store?.mqtt_vehicle_range_miles)}
          onchange={(v) => form.saveField('mqtt_vehicle_range_miles', v === 'true')}
        />
      </FormField>
      <FormField label={$_('config.vehicle.topic_soc')} status={$ss.mqtt_vehicle_soc ?? 'idle'}>
        <TextInput
          value={$config_store?.mqtt_vehicle_soc ?? ''}
          placeholder="topic/soc"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_vehicle_soc', v)}
        />
      </FormField>
      <FormField label={$_('config.vehicle.topic_range')} status={$ss.mqtt_vehicle_range ?? 'idle'}>
        <TextInput
          value={$config_store?.mqtt_vehicle_range ?? ''}
          placeholder="topic/range"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_vehicle_range', v)}
        />
      </FormField>
      <FormField label={$_('config.vehicle.topic_eta')} status={$ss.mqtt_vehicle_eta ?? 'idle'}>
        <TextInput
          value={$config_store?.mqtt_vehicle_eta ?? ''}
          placeholder="topic/timeleft"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_vehicle_eta', v)}
        />
      </FormField>
    </ConfigSection>
  {:else if src === 3}
    <ConfigSection title={$_('config.vehicle.src_http')}>
      <p class="text-sm text-text-dim">{$_('config.vehicle.http_info')}</p>
      <pre class="mt-2 rounded-xl bg-surface-2 p-3 text-xs text-text-dim">POST http://&lt;charger-ip&gt;/status
&#123; "battery_level": int, "battery_range": int, "time_to_full_charge": int &#125;</pre>
    </ConfigSection>
  {/if}
</ConfigPage>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the Vehicle config page"`

---

## Task 7: i18n, route wiring, mock route

**Files:**
- Modify: `src/lib/i18n/en.json`, `src/lib/routes.js`, `dev/mock-plugin.js`

- [ ] **Step 1: Extend the `config` object in `en.json`** with these sub-objects
(alongside the existing keys — do not remove anything):

```json
"evse": {
  "current": "Current limits",
  "maxcurrent": "Maximum current",
  "maxcurrent_hard": "Hardware maximum",
  "behaviour": "Behaviour",
  "defaultstate": "Default state on power-up",
  "disabled": "Disabled",
  "active": "Active",
  "threephase": "Three-phase supply",
  "singlephase": "Single phase",
  "threephase_yes": "Three phase",
  "service": "Service level",
  "service_auto": "Auto",
  "service_l1": "Level 1",
  "service_l2": "Level 2",
  "pause_mode": "Disable charger when paused",
  "start_window": "Randomised start window",
  "start_window_desc": "Spreads charge starts over this many seconds to ease grid load.",
  "led_brightness": "LED brightness",
  "sensor": "Sensor calibration",
  "scale": "Current sensor scale",
  "offset": "Current sensor offset"
},
"safety": {
  "warning": "Not every safety check is enabled.",
  "checks": "Safety checks",
  "gfci_check": "GFCI self-test",
  "ground_check": "Ground monitoring",
  "relay_check": "Stuck-relay detection",
  "temp_check": "Temperature monitoring",
  "diode_check": "Diode check",
  "vent_check": "Ventilation check",
  "faults": "Fault counters",
  "gfci_count": "GFCI faults",
  "noground_count": "No-ground faults",
  "stuck_count": "Stuck-relay faults"
},
"time": {
  "status": "Device time",
  "device_time": "Current time",
  "source": "Time source",
  "manual": "Set manually",
  "ntp": "Network time (NTP)",
  "ntp_host": "NTP server",
  "set_clock": "Device clock",
  "set_clock_desc": "Set the charger's clock to this device's current time.",
  "set_now": "Set to browser time",
  "timezone": "Time zone"
},
"rfid": {
  "enable": "Enable RFID",
  "manage": "Scan a tag",
  "scan": "Scan",
  "place_tag": "Hold a tag against the reader…",
  "uid": "UID",
  "register": "Register tag",
  "already": "This tag is already registered.",
  "registered": "Registered tags",
  "remove": "Remove",
  "remove_all": "Remove all"
},
"vehicle": {
  "source": "Vehicle data source",
  "src_none": "None",
  "src_tesla": "Tesla",
  "src_mqtt": "MQTT",
  "src_http": "HTTP push",
  "range_unit": "Range unit",
  "km": "Kilometres",
  "miles": "Miles",
  "tesla_note": "Enter Tesla API tokens obtained from a Tesla auth tool.",
  "access_token": "Access token",
  "refresh_token": "Refresh token",
  "topic_soc": "State-of-charge topic",
  "topic_range": "Range topic",
  "topic_eta": "Time-to-charge topic",
  "http_info": "Push vehicle data to the charger with an HTTP POST:"
}
```

Validate the file is parseable JSON.

- [ ] **Step 2: Wire the routes** — in `src/lib/routes.js`, add five imports and five
override assignments after the placeholder loop:

```js
import Evse from '../routes/settings/Evse.svelte'
import Safety from '../routes/settings/Safety.svelte'
import Time from '../routes/settings/Time.svelte'
import Rfid from '../routes/settings/Rfid.svelte'
import Vehicle from '../routes/settings/Vehicle.svelte'
```

```js
routes['/settings/evse'] = Evse
routes['/settings/safety'] = Safety
routes['/settings/time'] = Time
routes['/settings/rfid'] = Rfid
routes['/settings/vehicle'] = Vehicle
```

- [ ] **Step 3: Add the mock RFID-scan route** — in `dev/mock-plugin.js`, find the HTTP
mock middleware that serves the fixture routes and add a handler so the RFID page's
scan works offline. `GET /api/rfid/add` should respond `200` with the plain-text body
`1` (the device returns a scan-started acknowledgement). Match the style of the
existing fixture routes (they branch on `req.url`). Keep it minimal.

- [ ] **Step 4: Verify** — `npm test` green; `npm run build` succeeds, assets gzipped;
`en.json` valid JSON.
- [ ] **Step 5: Commit** — `git commit -m "Wire the Charger config pages and i18n"`

---

## Verification gate (before merge)

- [ ] `npm test` — all tests pass.
- [ ] `npm run build` — succeeds; all `dist/assets` JS/CSS gzipped (except `sw.js`).
- [ ] Playwright visual check — `npm run dev:mock`, visit `/#/settings/evse`,
      `/safety`, `/time`, `/rfid`, `/vehicle`. Confirm fields render, conditional
      sections toggle, the timezone selector is populated, no console/page errors.

## On completion

Hand off to `superpowers:finishing-a-development-branch` to merge `config-charger` to
`main`. Then proceed to the Energy batch.
