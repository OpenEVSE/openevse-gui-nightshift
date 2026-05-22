# Config Connectivity Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four Connectivity config pages — Network, HTTP, MQTT, OCPP — on the
Foundation scaffolding, plus the shared `createConfigForm` save helper every later
config page reuses.

**Architecture:** Each page is a route component in `src/routes/settings/`. It is the
only store-aware unit: it subscribes to `config_store` / `status_store` (and
`certificate_store` for MQTT) and owns all writes through `createConfigForm()`. Fields
render as `FormField` + a UI primitive; device info as `ReadOnlyRow`. Per-field save
(spec §6): controls emit on change/blur → `form.saveField(name, value)`.

**Tech Stack:** Svelte 5 runes, Vite 8, Tailwind 4, svelte-i18n, Vitest +
@testing-library/svelte.

**Reference:** `docs/superpowers/specs/2026-05-22-config-system-design.md` — §6 (save
model), §7.1–7.4 (the four pages). The Foundation components (`ConfigPage`,
`ConfigSection`, `FormField`, `ReadOnlyRow`, `TextInput`, `PasswordInput`,
`NumberInput`, `Toggle`, `Select`) already exist on `main`.

---

## File Structure

**Create:**
- `src/lib/config/configForm.svelte.js` — shared save helper (Svelte 5 runes module)
- `src/lib/config/__tests__/configForm.test.js`
- `src/routes/settings/Network.svelte`, `Http.svelte`, `Mqtt.svelte`, `Ocpp.svelte`
- `src/routes/settings/__tests__/{Network,Http,Mqtt,Ocpp}.test.js`

**Modify:**
- `src/lib/i18n/en.json` — extend the `config` block
- `src/lib/routes.js` — point the four routes at the real components

**Conventions:** `config_store` imports `httpAPI` from `src/lib/api/httpAPI.js`; route
tests mock that path (`vi.mock('../../../lib/api/httpAPI.js', ...)` — note the path
depth from `src/routes/settings/__tests__/`). `config_store.upload` returns `true` when
the response `msg` is `"done"` or `"no change"`. Commit after every green step.

---

## Task 1: The shared save helper — `configForm.svelte.js`

`createConfigForm()` returns the per-field save machinery: a `saveState` store, a
`revert` counter (bumped on failure so controlled inputs resync to the confirmed store
value), and `saveField` / `savefields`. On success it updates `config_store`; on
failure it surfaces `showWriteError()` and bumps `revert`.

**Files:**
- Create: `src/lib/config/configForm.svelte.js`
- Test: `src/lib/config/__tests__/configForm.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/config/__tests__/configForm.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { httpAPI } from '../../api/httpAPI.js'
import { config_store } from '../../stores/config.js'
import { uistates_store } from '../../stores/uistates.js'
import { createConfigForm } from '../configForm.svelte.js'

describe('createConfigForm', () => {
  beforeEach(() => {
    config_store.set({ hostname: 'old' })
    uistates_store.resetAlertBox()
    httpAPI.mockReset()
  })

  it('saveField posts the field and updates the store on success', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const form = createConfigForm()
    const ok = await form.saveField('hostname', 'new')
    expect(ok).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ hostname: 'new' }))
    expect(get(config_store).hostname).toBe('new')
    expect(form.saveState.statusOf('hostname')).toBe('saved')
  })

  it('saveField marks error, does not change the store, and alerts on failure', async () => {
    httpAPI.mockResolvedValue('error')
    const form = createConfigForm()
    const ok = await form.saveField('hostname', 'new')
    expect(ok).toBe(false)
    expect(get(config_store).hostname).toBe('old')
    expect(form.saveState.statusOf('hostname')).toBe('error')
    expect(get(uistates_store).alertbox.visible).toBe(true)
  })

  it('revert counter increments only on failure', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const form = createConfigForm()
    const before = form.revert
    await form.saveField('hostname', 'a')
    expect(form.revert).toBe(before)
    httpAPI.mockResolvedValue('error')
    await form.saveField('hostname', 'b')
    expect(form.revert).toBe(before + 1)
  })

  it('saveFields posts several fields at once', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const form = createConfigForm()
    await form.saveFields({ www_username: '', www_password: '' })
    expect(httpAPI).toHaveBeenCalledWith(
      'POST', '/config', JSON.stringify({ www_username: '', www_password: '' }),
    )
    expect(get(config_store).www_username).toBe('')
  })
})
```

- [ ] **Step 2: Run it — expect FAIL** (`npx vitest run src/lib/config/__tests__/configForm.test.js`).

- [ ] **Step 3: Implement**

```js
// src/lib/config/configForm.svelte.js
// Per-field save machinery shared by every config page. createConfigForm()
// returns a saveState store, a `revert` counter (bumped on failure so
// controlled inputs resync to the confirmed store value), and the save fns.
import { config_store } from '../stores/config.js'
import { serialQueue } from '../queue.js'
import { showWriteError } from '../alerts.js'
import { createSaveState } from './saveState.js'

export function createConfigForm() {
  const saveState = createSaveState()
  let revert = $state(0)

  async function saveFields(fields) {
    const names = Object.keys(fields)
    names.forEach((n) => saveState.begin(n))
    const ok = await serialQueue.add(() => config_store.upload(fields))
    if (ok) {
      config_store.update((c) => ({ ...c, ...fields }))
      names.forEach((n) => saveState.succeed(n))
    } else {
      names.forEach((n) => saveState.fail(n))
      revert += 1
      showWriteError()
    }
    return ok
  }

  function saveField(name, value) {
    return saveFields({ [name]: value })
  }

  return {
    saveState,
    saveField,
    saveFields,
    get revert() {
      return revert
    },
  }
}
```

- [ ] **Step 4: Run it — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the shared config save helper"`

---

## Shared page conventions (Tasks 2–5)

Every page route follows this shape. Read it once; the four pages differ only in fields.

```svelte
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
  // ...other primitives as needed

  const form = createConfigForm()
  const ss = form.saveState
</script>
```

- A field's status is `$ss[name] ?? 'idle'` (`ss` is the saveState store).
- A field's value comes from `$config_store?.<name>` with a sensible `??` fallback.
- Text/password/number/select/toggle controls all take `revert={form.revert}` (except
  Toggle/Select, which have no draft buffer — pass it only to TextInput / PasswordInput
  / NumberInput) and `onchange={(v) => form.saveField('<name>', v)}`.
- Guard every `$config_store?.` / `$status_store?.` access — both stores may be
  `undefined` before the first load.

Route test skeleton (each page test starts from this):

```js
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
// import the page under test

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
})
```

---

## Task 2: Network page — `src/routes/settings/Network.svelte`

Spec §7.1. Read-only network status; editable hostname; AP block when
`config.wizard_passed`.

**Files:**
- Create: `src/routes/settings/Network.svelte`
- Test: `src/routes/settings/__tests__/Network.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/settings/__tests__/Network.test.js
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
import Network from '../Network.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ mode: 'STA', ipaddress: '10.0.0.5', macaddress: 'AA:BB' })
  config_store.set({ hostname: 'openevse-1', wizard_passed: false })
})

describe('Network page', () => {
  it('shows read-only network status', () => {
    const { getByText } = render(Network)
    expect(getByText('10.0.0.5')).toBeInTheDocument()
    expect(getByText('AA:BB')).toBeInTheDocument()
  })

  it('saves the hostname on blur', async () => {
    const { getByDisplayValue } = render(Network)
    const input = getByDisplayValue('openevse-1')
    await fireEvent.input(input, { target: { value: 'garage' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ hostname: 'garage' }))
  })

  it('hides the AP block until the setup wizard has passed', () => {
    const { queryByText } = render(Network)
    expect(queryByText('config.network.apssid')).not.toBeInTheDocument()
    config_store.set({ hostname: 'openevse-1', wizard_passed: true })
  })

  it('shows the AP block when wizard_passed', () => {
    config_store.set({ hostname: 'openevse-1', wizard_passed: true, ap_ssid: 'ap', ap_pass: '' })
    const { getByText } = render(Network)
    expect(getByText('config.network.apssid')).toBeInTheDocument()
  })

  it('surfaces the write-error alert on a failed save', async () => {
    httpAPI.mockResolvedValue('error')
    const { getByDisplayValue } = render(Network)
    const input = getByDisplayValue('openevse-1')
    await fireEvent.input(input, { target: { value: 'x' } })
    await fireEvent.blur(input)
    expect(get(uistates_store).alertbox.visible).toBe(true)
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/routes/settings/Network.svelte -->
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

  const form = createConfigForm()
  const ss = form.saveState

  let connected = $derived(
    !!($status_store?.wifi_client_connected || $status_store?.eth_connected === 1),
  )
</script>

<ConfigPage title={$_('config.pages.network')}>
  <ConfigSection title={$_('config.network.status')}>
    <ReadOnlyRow label={$_('config.network.mode')} value={$status_store?.mode} />
    <ReadOnlyRow label={$_('config.network.ip')} value={$status_store?.ipaddress} />
    {#if $status_store?.macaddress}
      <ReadOnlyRow label={$_('config.network.mac')} value={$status_store.macaddress} />
    {/if}
    <ReadOnlyRow
      label={$_('config.network.connected')}
      value={connected ? $_('config.connected') : $_('config.not_connected')}
      tone={connected ? 'ok' : 'error'}
    />
    {#if $config_store?.ssid}
      <ReadOnlyRow label={$_('config.network.ssid')} value={$config_store.ssid} />
      <ReadOnlyRow label={$_('config.network.signal')} value={$status_store?.srssi} />
    {/if}
  </ConfigSection>

  <ConfigSection>
    <FormField label={$_('config.network.host')} status={$ss.hostname ?? 'idle'}>
      <TextInput
        value={$config_store?.hostname ?? ''}
        placeholder="openevse"
        revert={form.revert}
        onchange={(v) => form.saveField('hostname', v)}
      />
    </FormField>
  </ConfigSection>

  {#if $config_store?.wizard_passed}
    <ConfigSection title={$_('config.network.ap')}>
      <p class="mb-1 text-xs text-text-dim">{$_('config.network.apdefault')}</p>
      <FormField label={$_('config.network.apssid')} status={$ss.ap_ssid ?? 'idle'}>
        <TextInput
          value={$config_store?.ap_ssid ?? ''}
          placeholder="openevse"
          revert={form.revert}
          onchange={(v) => form.saveField('ap_ssid', v)}
        />
      </FormField>
      <FormField label={$_('config.network.appass')} status={$ss.ap_pass ?? 'idle'}>
        <PasswordInput
          value={$config_store?.ap_pass ?? ''}
          placeholder="openevse"
          revert={form.revert}
          onchange={(v) => form.saveField('ap_pass', v)}
        />
      </FormField>
    </ConfigSection>
  {/if}
</ConfigPage>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the Network config page"`

---

## Task 3: HTTP page — `src/routes/settings/Http.svelte`

Spec §7.2. There is **no `auth_enabled` config field** — auth is "on" when both
`www_username` and `www_password` are set. The page uses a local UI toggle: turning it
**off** saves both credentials as empty (`form.saveFields`); turning it **on** just
reveals the two fields. Plus a language `Select`.

**Files:**
- Create: `src/routes/settings/Http.svelte`
- Test: `src/routes/settings/__tests__/Http.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/settings/__tests__/Http.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t, locales: { subscribe: (fn) => { fn(['en']); return () => {} } } }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Http from '../Http.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
})

describe('HTTP page', () => {
  it('shows the credential fields when auth is already configured', () => {
    config_store.set({ www_username: 'admin', www_password: '••••••••••', lang: 'en' })
    const { getByText } = render(Http)
    expect(getByText('config.http.username')).toBeInTheDocument()
  })

  it('hides the credential fields when auth is off', () => {
    config_store.set({ www_username: '', www_password: '', lang: 'en' })
    const { queryByText } = render(Http)
    expect(queryByText('config.http.username')).not.toBeInTheDocument()
  })

  it('turning the auth toggle off clears both credentials', async () => {
    config_store.set({ www_username: 'admin', www_password: '••••••••••', lang: 'en' })
    const { getByRole } = render(Http)
    await fireEvent.click(getByRole('switch'))
    expect(httpAPI).toHaveBeenCalledWith(
      'POST', '/config', JSON.stringify({ www_username: '', www_password: '' }),
    )
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/routes/settings/Http.svelte -->
<script>
  import { _, locales } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import PasswordInput from '../../lib/components/ui/PasswordInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  // Auth has no config flag — it is "on" when both credentials are set.
  let authOn = $state(false)
  $effect(() => {
    authOn = !!($config_store?.www_username && $config_store?.www_password)
  })

  function toggleAuth(next) {
    authOn = next
    // Turning auth off clears both credentials; turning it on only reveals
    // the fields — the user then fills and saves them per-field.
    if (!next) form.saveFields({ www_username: '', www_password: '' })
  }

  let langOptions = $derived(($locales ?? ['en']).map((l) => ({ value: l, label: l })))
</script>

<ConfigPage title={$_('config.pages.http')}>
  <ConfigSection title={$_('config.http.auth')}>
    <FormField label={$_('config.http.auth')}>
      <Toggle checked={authOn} label={$_('config.http.auth')} onchange={toggleAuth} />
    </FormField>
    {#if authOn}
      <FormField label={$_('config.http.username')} status={$ss.www_username ?? 'idle'}>
        <TextInput
          value={$config_store?.www_username ?? ''}
          maxlength={15}
          revert={form.revert}
          onchange={(v) => form.saveField('www_username', v)}
        />
      </FormField>
      <FormField label={$_('config.http.password')} status={$ss.www_password ?? 'idle'}>
        <PasswordInput
          value={$config_store?.www_password ?? ''}
          maxlength={15}
          revert={form.revert}
          onchange={(v) => form.saveField('www_password', v)}
        />
      </FormField>
    {/if}
  </ConfigSection>

  <ConfigSection>
    <FormField label={$_('config.http.lang')} status={$ss.lang ?? 'idle'}>
      <Select
        options={langOptions}
        value={$config_store?.lang ?? 'en'}
        onchange={(v) => form.saveField('lang', v)}
      />
    </FormField>
  </ConfigSection>
</ConfigPage>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the HTTP config page"`

---

## Task 4: MQTT page — `src/routes/settings/Mqtt.svelte`

Spec §7.3. `mqtt_enabled` toggle gates the whole form. The TLS sub-block
(`mqtt_reject_unauthorized`, `mqtt_certificate_id`) shows only when `mqtt_protocol`
is `mqtts`. Protocol options come from `config.mqtt_supported_protocols`; client-cert
options from `certificate_store`.

**Files:**
- Create: `src/routes/settings/Mqtt.svelte`
- Test: `src/routes/settings/__tests__/Mqtt.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/settings/__tests__/Mqtt.test.js
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
import { certificate_store } from '../../../lib/stores/certificates.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Mqtt from '../Mqtt.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ mqtt_connected: false })
  certificate_store.set([])
})

describe('MQTT page', () => {
  it('hides the form until mqtt is enabled', () => {
    config_store.set({ mqtt_enabled: false, mqtt_supported_protocols: ['mqtt'] })
    const { queryByText } = render(Mqtt)
    expect(queryByText('config.mqtt.server')).not.toBeInTheDocument()
  })

  it('shows the form when mqtt is enabled', () => {
    config_store.set({ mqtt_enabled: true, mqtt_protocol: 'mqtt', mqtt_supported_protocols: ['mqtt', 'mqtts'] })
    const { getByText } = render(Mqtt)
    expect(getByText('config.mqtt.server')).toBeInTheDocument()
  })

  it('shows the TLS block only for the mqtts protocol', () => {
    config_store.set({ mqtt_enabled: true, mqtt_protocol: 'mqtt', mqtt_supported_protocols: ['mqtt', 'mqtts'] })
    const { queryByText, rerender } = render(Mqtt)
    expect(queryByText('config.mqtt.reject_unauthorized')).not.toBeInTheDocument()
    config_store.set({ mqtt_enabled: true, mqtt_protocol: 'mqtts', mqtt_supported_protocols: ['mqtt', 'mqtts'] })
    expect(queryByText('config.mqtt.reject_unauthorized')).toBeInTheDocument()
  })

  it('saves the server field on blur', async () => {
    config_store.set({ mqtt_enabled: true, mqtt_protocol: 'mqtt', mqtt_server: 'old', mqtt_supported_protocols: ['mqtt'] })
    const { getByDisplayValue } = render(Mqtt)
    const input = getByDisplayValue('old')
    await fireEvent.input(input, { target: { value: 'broker.local' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ mqtt_server: 'broker.local' }))
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/routes/settings/Mqtt.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { certificate_store } from '../../lib/stores/certificates.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import PasswordInput from '../../lib/components/ui/PasswordInput.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let enabled = $derived(!!$config_store?.mqtt_enabled)
  let isTls = $derived($config_store?.mqtt_protocol === 'mqtts')
  let protocolOptions = $derived(
    ($config_store?.mqtt_supported_protocols ?? []).map((p) => ({ value: p, label: p })),
  )
  let certOptions = $derived([
    { value: '', label: $_('config.mqtt.cert_none') },
    ...($certificate_store ?? [])
      .filter((c) => c.type === 'client')
      .map((c) => ({ value: String(c.id), label: c.name })),
  ])
</script>

<ConfigPage title={$_('config.pages.mqtt')}>
  <ConfigSection>
    <FormField label={$_('config.mqtt.enable')}>
      <Toggle
        checked={enabled}
        label={$_('config.mqtt.enable')}
        onchange={(v) => form.saveField('mqtt_enabled', v)}
      />
    </FormField>
    {#if enabled}
      <ReadOnlyRow
        label={$_('config.connected')}
        value={$status_store?.mqtt_connected ? $_('config.connected') : $_('config.not_connected')}
        tone={$status_store?.mqtt_connected ? 'ok' : 'error'}
      />
    {/if}
  </ConfigSection>

  {#if enabled}
    <ConfigSection title={$_('config.mqtt.broker')}>
      <FormField label={$_('config.mqtt.protocol')} status={$ss.mqtt_protocol ?? 'idle'}>
        <Select
          options={protocolOptions}
          value={$config_store?.mqtt_protocol ?? ''}
          onchange={(v) => form.saveField('mqtt_protocol', v)}
        />
      </FormField>
      <FormField label={$_('config.mqtt.server')} status={$ss.mqtt_server ?? 'idle'}>
        <TextInput
          value={$config_store?.mqtt_server ?? ''}
          placeholder="server IP / hostname"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_server', v)}
        />
      </FormField>
      <FormField label={$_('config.mqtt.port')} status={$ss.mqtt_port ?? 'idle'}>
        <NumberInput
          value={$config_store?.mqtt_port ?? null}
          placeholder="1883"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_port', v)}
        />
      </FormField>
      <FormField label={$_('config.mqtt.user')} status={$ss.mqtt_user ?? 'idle'}>
        <TextInput
          value={$config_store?.mqtt_user ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_user', v)}
        />
      </FormField>
      <FormField label={$_('config.mqtt.password')} status={$ss.mqtt_pass ?? 'idle'}>
        <PasswordInput
          value={$config_store?.mqtt_pass ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_pass', v)}
        />
      </FormField>
    </ConfigSection>

    {#if isTls}
      <ConfigSection title={$_('config.mqtt.tls')}>
        <FormField label={$_('config.mqtt.reject_unauthorized')}>
          <Toggle
            checked={!!$config_store?.mqtt_reject_unauthorized}
            label={$_('config.mqtt.reject_unauthorized')}
            onchange={(v) => form.saveField('mqtt_reject_unauthorized', v)}
          />
        </FormField>
        <FormField label={$_('config.mqtt.certificate')} status={$ss.mqtt_certificate_id ?? 'idle'}>
          <Select
            options={certOptions}
            value={String($config_store?.mqtt_certificate_id ?? '')}
            onchange={(v) => form.saveField('mqtt_certificate_id', v)}
          />
        </FormField>
      </ConfigSection>
    {/if}

    <ConfigSection title={$_('config.mqtt.topics')}>
      <FormField
        label={$_('config.mqtt.topic')}
        description={$_('config.mqtt.topic_desc')}
        status={$ss.mqtt_topic ?? 'idle'}
      >
        <TextInput
          value={$config_store?.mqtt_topic ?? ''}
          placeholder="openevse"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_topic', v)}
        />
      </FormField>
      <FormField
        label={$_('config.mqtt.announce')}
        description={$_('config.mqtt.announce_desc')}
        status={$ss.mqtt_announce_topic ?? 'idle'}
      >
        <TextInput
          value={$config_store?.mqtt_announce_topic ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_announce_topic', v)}
        />
      </FormField>
      <FormField label={$_('config.mqtt.retained')}>
        <Toggle
          checked={!!$config_store?.mqtt_retained}
          label={$_('config.mqtt.retained')}
          onchange={(v) => form.saveField('mqtt_retained', v)}
        />
      </FormField>
      <FormField
        label={$_('config.mqtt.vrms')}
        description={$_('config.mqtt.vrms_desc')}
        status={$ss.mqtt_vrms ?? 'idle'}
      >
        <TextInput
          value={$config_store?.mqtt_vrms ?? ''}
          placeholder="topic/voltage"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_vrms', v)}
        />
      </FormField>
    </ConfigSection>
  {/if}
</ConfigPage>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the MQTT config page"`

---

## Task 5: OCPP page — `src/routes/settings/Ocpp.svelte`

Spec §7.4. `ocpp_enabled` toggle gates the form. `ocpp_idtag` shows only when
`ocpp_auth_auto` is on.

**Files:**
- Create: `src/routes/settings/Ocpp.svelte`
- Test: `src/routes/settings/__tests__/Ocpp.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/settings/__tests__/Ocpp.test.js
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
import Ocpp from '../Ocpp.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ ocpp_connected: false })
})

describe('OCPP page', () => {
  it('hides the form until ocpp is enabled', () => {
    config_store.set({ ocpp_enabled: false })
    const { queryByText } = render(Ocpp)
    expect(queryByText('config.ocpp.server')).not.toBeInTheDocument()
  })

  it('shows the form when ocpp is enabled', () => {
    config_store.set({ ocpp_enabled: true, ocpp_auth_auto: false })
    const { getByText } = render(Ocpp)
    expect(getByText('config.ocpp.server')).toBeInTheDocument()
  })

  it('shows the idtag field only when auto-auth is on', () => {
    config_store.set({ ocpp_enabled: true, ocpp_auth_auto: false })
    const { queryByText } = render(Ocpp)
    expect(queryByText('config.ocpp.idtag')).not.toBeInTheDocument()
    config_store.set({ ocpp_enabled: true, ocpp_auth_auto: true })
    expect(queryByText('config.ocpp.idtag')).toBeInTheDocument()
  })

  it('saves the server field on blur', async () => {
    config_store.set({ ocpp_enabled: true, ocpp_server: 'old', ocpp_auth_auto: false })
    const { getByDisplayValue } = render(Ocpp)
    const input = getByDisplayValue('old')
    await fireEvent.input(input, { target: { value: 'wss://x' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ ocpp_server: 'wss://x' }))
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/routes/settings/Ocpp.svelte -->
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

  let enabled = $derived(!!$config_store?.ocpp_enabled)
  let autoAuth = $derived(!!$config_store?.ocpp_auth_auto)
</script>

<ConfigPage title={$_('config.pages.ocpp')}>
  <ConfigSection>
    <FormField label={$_('config.ocpp.enable')}>
      <Toggle
        checked={enabled}
        label={$_('config.ocpp.enable')}
        onchange={(v) => form.saveField('ocpp_enabled', v)}
      />
    </FormField>
    {#if enabled}
      <ReadOnlyRow
        label={$_('config.connected')}
        value={$status_store?.ocpp_connected ? $_('config.connected') : $_('config.not_connected')}
        tone={$status_store?.ocpp_connected ? 'ok' : 'error'}
      />
    {/if}
  </ConfigSection>

  {#if enabled}
    <ConfigSection title={$_('config.ocpp.server_section')}>
      <FormField label={$_('config.ocpp.server')} status={$ss.ocpp_server ?? 'idle'}>
        <TextInput
          value={$config_store?.ocpp_server ?? ''}
          placeholder="wss://domain/steve/websocket/CentralSystemService"
          revert={form.revert}
          onchange={(v) => form.saveField('ocpp_server', v)}
        />
      </FormField>
      <FormField label={$_('config.ocpp.chargeboxid')} status={$ss.ocpp_chargeBoxId ?? 'idle'}>
        <TextInput
          value={$config_store?.ocpp_chargeBoxId ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('ocpp_chargeBoxId', v)}
        />
      </FormField>
      <FormField label={$_('config.ocpp.authkey')} status={$ss.ocpp_authkey ?? 'idle'}>
        <PasswordInput
          value={$config_store?.ocpp_authkey ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('ocpp_authkey', v)}
        />
      </FormField>
    </ConfigSection>

    <ConfigSection title={$_('config.ocpp.auth')}>
      <FormField label={$_('config.ocpp.auth_auto')}>
        <Toggle
          checked={autoAuth}
          label={$_('config.ocpp.auth_auto')}
          onchange={(v) => form.saveField('ocpp_auth_auto', v)}
        />
      </FormField>
      {#if autoAuth}
        <FormField label={$_('config.ocpp.idtag')} status={$ss.ocpp_idtag ?? 'idle'}>
          <TextInput
            value={$config_store?.ocpp_idtag ?? ''}
            placeholder="F4D1A7694ECD21"
            revert={form.revert}
            onchange={(v) => form.saveField('ocpp_idtag', v)}
          />
        </FormField>
      {/if}
      <FormField label={$_('config.ocpp.auth_offline')}>
        <Toggle
          checked={!!$config_store?.ocpp_auth_offline}
          label={$_('config.ocpp.auth_offline')}
          onchange={(v) => form.saveField('ocpp_auth_offline', v)}
        />
      </FormField>
    </ConfigSection>

    <ConfigSection title={$_('config.ocpp.controls')}>
      <FormField label={$_('config.ocpp.suspend_evse')}>
        <Toggle
          checked={!!$config_store?.ocpp_suspend_evse}
          label={$_('config.ocpp.suspend_evse')}
          onchange={(v) => form.saveField('ocpp_suspend_evse', v)}
        />
      </FormField>
      <FormField label={$_('config.ocpp.energize_plug')}>
        <Toggle
          checked={!!$config_store?.ocpp_energize_plug}
          label={$_('config.ocpp.energize_plug')}
          onchange={(v) => form.saveField('ocpp_energize_plug', v)}
        />
      </FormField>
    </ConfigSection>
  {/if}
</ConfigPage>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the OCPP config page"`

---

## Task 6: i18n strings + route wiring

**Files:**
- Modify: `src/lib/i18n/en.json`
- Modify: `src/lib/routes.js`

- [ ] **Step 1: Extend the `config` object in `en.json`** — add these keys alongside the
existing ones (keep `config.network.con-ok`, `config.title`, `config.pages`, etc.):

```json
"connected": "Connected",
"not_connected": "Not connected",
"network": {
  "con-ok": "Connected — new address: ",
  "status": "Network status",
  "mode": "Mode",
  "ip": "IP address",
  "mac": "MAC address",
  "connected": "Connection",
  "ssid": "WiFi network",
  "signal": "Signal",
  "host": "Hostname",
  "ap": "Access point",
  "apdefault": "The charger's own WiFi network, used for setup and as a fallback.",
  "apssid": "AP network name",
  "appass": "AP password"
},
"http": {
  "auth": "Web interface password",
  "username": "Username",
  "password": "Password",
  "lang": "Language"
},
"mqtt": {
  "enable": "Enable MQTT",
  "broker": "Broker",
  "protocol": "Protocol",
  "server": "Server",
  "port": "Port",
  "user": "Username",
  "password": "Password",
  "tls": "TLS",
  "reject_unauthorized": "Reject self-signed certificates",
  "certificate": "Client certificate",
  "cert_none": "None",
  "topics": "Topics",
  "topic": "Base topic",
  "topic_desc": "Root topic the charger publishes and subscribes under.",
  "announce": "Announce topic",
  "announce_desc": "Topic used to announce the charger on the network.",
  "retained": "Retain published messages",
  "vrms": "Voltage topic",
  "vrms_desc": "Topic to read mains voltage from, when no internal sensor is present."
},
"ocpp": {
  "enable": "Enable OCPP",
  "server_section": "Central system",
  "server": "Server URL",
  "chargeboxid": "Charge box ID",
  "authkey": "Authorization key",
  "auth": "Authorization",
  "auth_auto": "Authorize automatically",
  "idtag": "ID tag",
  "auth_offline": "Allow charging while offline",
  "controls": "Charging controls",
  "suspend_evse": "Let OCPP suspend the charger",
  "energize_plug": "Energize plug on authorization"
}
```

Note: the `config.network` object **replaces** the old one-key version — make sure
`con-ok` is preserved inside it (shown above). Validate the file is valid JSON.

- [ ] **Step 2: Wire the routes** — in `src/lib/routes.js`, add the four imports and,
**after** the `for` loop that assigns placeholders, override the four:

```js
import Network from '../routes/settings/Network.svelte'
import Http from '../routes/settings/Http.svelte'
import Mqtt from '../routes/settings/Mqtt.svelte'
import Ocpp from '../routes/settings/Ocpp.svelte'
```

```js
// after the placeholder loop:
routes['/settings/network'] = Network
routes['/settings/http'] = Http
routes['/settings/mqtt'] = Mqtt
routes['/settings/ocpp'] = Ocpp
```

- [ ] **Step 3: Verify** — `npm test` green; `npm run build` succeeds, all `dist/assets`
gzipped. Validate `en.json` is parseable JSON.
- [ ] **Step 4: Commit** — `git commit -m "Wire the Connectivity config pages and i18n"`

---

## Verification gate (before merge)

- [ ] `npm test` — all tests pass.
- [ ] `npm run build` — succeeds; all `dist/assets` JS/CSS gzipped (except `sw.js`).
- [ ] Playwright visual check — `npm run dev:mock`, visit `/#/settings/network`,
      `/#/settings/http`, `/#/settings/mqtt`, `/#/settings/ocpp`. Confirm each page
      renders its fields, toggles reveal/hide their sections, and there are no
      console/page errors.

## On completion

Hand off to `superpowers:finishing-a-development-branch` to merge `config-connectivity`
to `main`. Then proceed to the Charger batch.
