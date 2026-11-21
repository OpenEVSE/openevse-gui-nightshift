# Deferred Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three features deferred from the Settings build — WiFi scan/join
(Network page), Tesla OAuth login (Vehicle page), Firmware GitHub check + install
(Firmware page).

**Architecture:** Each feature is added to its existing route component (the only
store-aware unit). Pure logic goes in new `src/lib/config/*.js` modules, unit-tested.
Ephemeral data (networks, vehicles, releases) is route-local `$state`. Writes go
through `serialQueue`; failures call `showWriteError()`. Svelte 5 runes; Tailwind
theme tokens; strings via `$_()`.

**Tech Stack:** Svelte 5, Vite 8, Tailwind 4, svelte-i18n, Vitest +
@testing-library/svelte.

**Reference:** `docs/superpowers/specs/2026-05-22-deferred-features-design.md`.

---

## File Structure

**Create:**
- `src/lib/config/wifi.js` + `__tests__/wifi.test.js`
- `src/lib/config/firmware.js` + `__tests__/firmware.test.js`
- `src/lib/config/tesla.js` + `__tests__/tesla.test.js`
- `dev/fixtures/scan.json`, `dev/fixtures/tesla-vehicles.json`

**Modify:**
- `src/routes/settings/Network.svelte`, `Firmware.svelte`, `Vehicle.svelte` + their tests
- `dev/mock-plugin.js` — add `GET /scan` and `GET /tesla/vehicles`
- `src/lib/i18n/en.json`, `es.json`, `fr.json`, `hu.json`

**Conventions:** route tests mock `svelte-i18n` (standard stub) and
`../../../lib/api/httpAPI.js`; use `vi.waitFor` after async actions. The pure modules
carry the unit-test coverage. Commit after every green step.

---

## Task 1: WiFi helper — `src/lib/config/wifi.js`

**Files:** Create `src/lib/config/wifi.js`, `src/lib/config/__tests__/wifi.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/config/__tests__/wifi.test.js
import { describe, it, expect } from 'vitest'
import { normalizeNetworks, signalIcon, isSecured } from '../wifi.js'

describe('normalizeNetworks', () => {
  it('dedupes by SSID keeping the strongest signal, sorts by signal', () => {
    const out = normalizeNetworks([
      { ssid: 'A', rssi: -70 },
      { ssid: 'B', rssi: -50 },
      { ssid: 'A', rssi: -55 },
    ])
    expect(out.map((n) => n.ssid)).toEqual(['B', 'A'])
    expect(out.find((n) => n.ssid === 'A').rssi).toBe(-55)
  })
  it('drops entries with no SSID and tolerates non-arrays', () => {
    expect(normalizeNetworks([{ rssi: -40 }, { ssid: '' }])).toEqual([])
    expect(normalizeNetworks(undefined)).toEqual([])
    expect(normalizeNetworks('error')).toEqual([])
  })
})

describe('signalIcon', () => {
  it('maps RSSI to a strength icon', () => {
    expect(signalIcon(-50)).toBe('mdi:wifi-strength-4')
    expect(signalIcon(-60)).toBe('mdi:wifi-strength-3')
    expect(signalIcon(-70)).toBe('mdi:wifi-strength-2')
    expect(signalIcon(-90)).toBe('mdi:wifi-strength-1')
    expect(signalIcon(undefined)).toBe('mdi:wifi-strength-outline')
  })
})

describe('isSecured', () => {
  it('treats open/none/0 as unsecured, everything else as secured', () => {
    expect(isSecured({ encryption: 'open' })).toBe(false)
    expect(isSecured({ encryption: 'none' })).toBe(false)
    expect(isSecured({ encryption: 0 })).toBe(false)
    expect(isSecured({ encryption: 'wpa2' })).toBe(true)
    expect(isSecured({ encryption: 3 })).toBe(true)
  })
  it('assumes secured when encryption is unknown', () => {
    expect(isSecured({})).toBe(true)
  })
})
```

- [ ] **Step 2: Run it — expect FAIL** (`npx vitest run src/lib/config/__tests__/wifi.test.js`).

- [ ] **Step 3: Implement**

```js
// src/lib/config/wifi.js
// Pure helpers for the WiFi scan list.

/** Dedupe a scan result by SSID (keep the strongest), strongest-first. */
export function normalizeNetworks(list) {
  if (!Array.isArray(list)) return []
  const byssid = new Map()
  for (const n of list) {
    if (!n || !n.ssid) continue
    const existing = byssid.get(n.ssid)
    if (!existing || (n.rssi ?? -999) > (existing.rssi ?? -999)) {
      byssid.set(n.ssid, n)
    }
  }
  return [...byssid.values()].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999))
}

/** An mdi WiFi-strength icon name for a dBm RSSI value. */
export function signalIcon(rssi) {
  if (rssi === undefined || rssi === null) return 'mdi:wifi-strength-outline'
  if (rssi >= -55) return 'mdi:wifi-strength-4'
  if (rssi >= -65) return 'mdi:wifi-strength-3'
  if (rssi >= -75) return 'mdi:wifi-strength-2'
  return 'mdi:wifi-strength-1'
}

/** Whether a network needs a password. Unknown encryption → assume secured. */
export function isSecured(network) {
  const e = network?.encryption
  if (e === undefined || e === null) return true
  if (typeof e === 'string') return !/^(none|open)$/i.test(e)
  if (typeof e === 'number') return e !== 0
  return e !== false
}
```

- [ ] **Step 4: Run it — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the WiFi scan-list helper"`

---

## Task 2: Network page — WiFi scan & join

Add a "Change WiFi" section to `src/routes/settings/Network.svelte`: scan, pick a
network, enter a password, connect.

**Files:** Modify `src/routes/settings/Network.svelte`; create/extend
`src/routes/settings/__tests__/Network.test.js`.

- [ ] **Step 1: Add to the `<script>`** of `Network.svelte` — new imports and state.
After the existing imports add:

```js
  import { serialQueue } from '../../lib/queue.js'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import { showWriteError } from '../../lib/alerts.js'
  import { normalizeNetworks, signalIcon, isSecured } from '../../lib/config/wifi.js'
  import Icon from '../../lib/icons/Icon.svelte'
  import Button from '../../lib/components/ui/Button.svelte'
  import PasswordInputCtl from '../../lib/components/ui/PasswordInput.svelte'
```

(`PasswordInput` is already imported as `PasswordInput`; the WiFi password uses a
plain input below, so no alias is actually needed — remove the `PasswordInputCtl`
line; it is listed only to flag the existing `PasswordInput` import is reused.)

After the existing `connected` derived, add:

```js
  // ── WiFi scan / join ────────────────────────────────────────────────────
  let networks = $state([])
  let scanning = $state(false)
  let scanError = $state(false)
  let selected = $state(null) // the picked network object
  let wifiPass = $state('')
  let joining = $state(false)
  let joined = $state(false)

  async function scanWifi() {
    if (scanning) return
    scanning = true
    scanError = false
    networks = []
    selected = null
    const res = await serialQueue.add(() => httpAPI('GET', '/scan'))
    scanning = false
    if (!res || res === 'error' || !Array.isArray(res)) {
      scanError = true
      return
    }
    networks = normalizeNetworks(res)
  }

  function pickNetwork(n) {
    selected = n
    wifiPass = ''
  }

  async function joinWifi() {
    if (joining || !selected) return
    joining = true
    const ok = await serialQueue.add(() =>
      config_store.upload({ ssid: selected.ssid, pass: wifiPass }),
    )
    joining = false
    if (ok) {
      joined = true
      networks = []
      selected = null
    } else {
      showWriteError()
    }
  }
</script>
```

(That closing `</script>` replaces the existing one.)

- [ ] **Step 2: Add the WiFi `ConfigSection`** to the template, immediately after the
status `ConfigSection` (before the hostname section):

```svelte
  <ConfigSection title={$_('config.network.wifi')}>
    {#if joined}
      <p class="py-2 text-sm text-text-dim">{$_('config.network.connecting')}</p>
    {:else}
      <div class="py-1">
        <Button
          label={scanning ? $_('config.network.scanning') : $_('config.network.scan')}
          variant="ghost"
          disabled={scanning}
          onclick={scanWifi}
        />
      </div>

      {#if scanError}
        <p class="py-2 text-sm text-error">{$_('config.network.scan_error')}</p>
      {:else if networks.length > 0}
        <ul class="divide-y divide-border">
          {#each networks as n (n.ssid)}
            <li>
              <button
                type="button"
                onclick={() => pickNetwork(n)}
                class="flex w-full items-center gap-3 py-2 text-left text-sm
                       {selected?.ssid === n.ssid ? 'text-accent' : 'text-text'}"
              >
                <Icon icon={signalIcon(n.rssi)} size={18} class="text-text-dim" />
                <span class="flex-1">{n.ssid}</span>
                {#if isSecured(n)}
                  <Icon icon="mdi:lock-outline" size={14} class="text-text-dim" />
                {/if}
              </button>

              {#if selected?.ssid === n.ssid}
                <div class="flex items-end gap-2 pb-3 pl-7">
                  {#if isSecured(n)}
                    <input
                      type="password"
                      placeholder={$_('config.network.wifi_password')}
                      aria-label={$_('config.network.wifi_password')}
                      value={wifiPass}
                      oninput={(e) => (wifiPass = e.currentTarget.value)}
                      class="flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2
                             text-sm text-text focus:border-accent focus:outline-none"
                    />
                  {/if}
                  <div class="shrink-0">
                    <Button
                      label={joining ? $_('config.network.connecting_btn') : $_('config.network.connect')}
                      disabled={joining}
                      onclick={joinWifi}
                    />
                  </div>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </ConfigSection>
```

- [ ] **Step 3: Add route tests** to `Network.test.js` (append new `it` blocks inside
the existing `describe`):

```js
  it('lists scanned networks strongest-first', async () => {
    httpAPI.mockImplementation((m, url) =>
      url === '/scan'
        ? Promise.resolve([
            { ssid: 'Weak', rssi: -80 },
            { ssid: 'Strong', rssi: -45, encryption: 'wpa2' },
          ])
        : Promise.resolve({ msg: 'done' }),
    )
    const { getByText } = render(Network)
    await fireEvent.click(getByText('config.network.scan'))
    await vi.waitFor(() => {
      expect(getByText('Strong')).toBeInTheDocument()
      expect(getByText('Weak')).toBeInTheDocument()
    })
  })

  it('joins a picked network with ssid + pass', async () => {
    httpAPI.mockImplementation((m, url) =>
      url === '/scan'
        ? Promise.resolve([{ ssid: 'Home', rssi: -50, encryption: 'wpa2' }])
        : Promise.resolve({ msg: 'done' }),
    )
    const { getByText, getByLabelText } = render(Network)
    await fireEvent.click(getByText('config.network.scan'))
    await vi.waitFor(() => getByText('Home'))
    await fireEvent.click(getByText('Home'))
    const pass = getByLabelText('config.network.wifi_password')
    await fireEvent.input(pass, { target: { value: 'secret' } })
    await fireEvent.click(getByText('config.network.connect'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith(
        'POST', '/config', JSON.stringify({ ssid: 'Home', pass: 'secret' }),
      )
    })
  })
```

- [ ] **Step 4: Run** `npx vitest run src/routes/settings/__tests__/Network.test.js` — PASS.
- [ ] **Step 5: Commit** — `git commit -m "Add WiFi scan and join to the Network page"`

---

## Task 3: Firmware helper — `src/lib/config/firmware.js`

**Files:** Create `src/lib/config/firmware.js`, `src/lib/config/__tests__/firmware.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/config/__tests__/firmware.test.js
import { describe, it, expect } from 'vitest'
import { classifyReleases, findAsset, updateAvailable } from '../firmware.js'

const RELEASES = [
  { tag_name: 'v5.1.2', name: 'v5.1.2', prerelease: false, assets: [
    { name: 'esp32-gw.bin', browser_download_url: 'u1' },
  ] },
  { tag_name: 'v5.2.0-rc1', name: 'v5.2.0-rc1', prerelease: true, assets: [] },
  { tag_name: 'latest', name: 'dev', prerelease: true, assets: [] },
]

describe('classifyReleases', () => {
  it('picks the stable, pre-release and daily entries', () => {
    const c = classifyReleases(RELEASES)
    expect(c.release.tag_name).toBe('v5.1.2')
    expect(c.prerelease.tag_name).toBe('v5.2.0-rc1')
    expect(c.daily.tag_name).toBe('latest')
  })
  it('returns nulls for an empty or non-array input', () => {
    expect(classifyReleases([])).toEqual({ release: null, prerelease: null, daily: null })
    expect(classifyReleases(undefined)).toEqual({ release: null, prerelease: null, daily: null })
  })
})

describe('findAsset', () => {
  it('matches an asset by buildenv prefix and .bin suffix', () => {
    expect(findAsset(RELEASES[0], 'esp32-gw').name).toBe('esp32-gw.bin')
  })
  it('returns null when nothing matches', () => {
    expect(findAsset(RELEASES[0], 'other-board')).toBe(null)
    expect(findAsset(RELEASES[1], 'esp32-gw')).toBe(null)
    expect(findAsset(null, 'esp32-gw')).toBe(null)
  })
})

describe('updateAvailable', () => {
  it('is true only when the latest is strictly newer', () => {
    expect(updateAvailable('v5.2.0', 'v5.1.2')).toBe(true)
    expect(updateAvailable('v5.1.2', 'v5.1.2')).toBe(false)
    expect(updateAvailable('v5.0.0', 'v5.1.2')).toBe(false)
  })
  it('is false for an unparseable installed version', () => {
    expect(updateAvailable('v5.2.0', 'local__abc_modified')).toBe(false)
    expect(updateAvailable('', 'v5.1.2')).toBe(false)
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```js
// src/lib/config/firmware.js
// GitHub firmware-release helpers for the Firmware page.
import { compareVersion } from '../utils.js'

export const RELEASES_URL =
  'https://api.github.com/repos/OpenEVSE/ESP32_WiFi_V4.x/releases'

/** Fetch the GitHub releases. Returns [] on any failure (never throws). */
export async function fetchReleases() {
  try {
    const res = await fetch(RELEASES_URL)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/** Split releases into the stable / pre-release / daily channels. */
export function classifyReleases(releases) {
  const list = Array.isArray(releases) ? releases : []
  return {
    release: list.find((r) => r && r.prerelease === false) ?? null,
    prerelease:
      list.find(
        (r) => r && r.prerelease === true && /^v\d+\.\d+/.test(r.tag_name ?? ''),
      ) ?? null,
    daily: list.find((r) => r && r.tag_name === 'latest') ?? null,
  }
}

/** The release asset whose name starts with buildenv and ends with .bin. */
export function findAsset(release, buildenv) {
  if (!release || !Array.isArray(release.assets) || !buildenv) return null
  return (
    release.assets.find(
      (a) =>
        a &&
        typeof a.name === 'string' &&
        a.name.startsWith(buildenv) &&
        a.name.endsWith('.bin'),
    ) ?? null
  )
}

/** True only when `latestName` is a strictly newer parseable version. */
export function updateAvailable(latestName, installedVersion) {
  if (!latestName || !installedVersion) return false
  try {
    return compareVersion(latestName, installedVersion) === 1
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run it — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the GitHub firmware-release helper"`

---

## Task 4: Firmware page — online updates

Add an "Online updates" section to `src/routes/settings/Firmware.svelte`.

**Files:** Modify `Firmware.svelte`; extend `Firmware.test.js`.

- [ ] **Step 1: Extend the `<script>`.** Add imports:

```js
  import { onMount } from 'svelte'
  import { classifyReleases, findAsset, updateAvailable, fetchReleases }
    from '../../lib/config/firmware.js'
```

Add state + logic (after `reloadCountdown`'s `$effect`):

```js
  // ── online (GitHub) updates ─────────────────────────────────────────────
  let releases = $state(null) // null = loading, [] = failed/empty
  let buildenv = $derived($config_store?.buildenv ?? '')
  let installed = $derived($config_store?.version ?? '')

  let channels = $derived(() => {
    if (!releases) return []
    const c = classifyReleases(releases)
    return [
      { key: 'release', rel: c.release },
      { key: 'prerelease', rel: c.prerelease },
      { key: 'daily', rel: c.daily },
    ]
      .map(({ key, rel }) => ({
        key,
        version: rel?.name ?? rel?.tag_name ?? '',
        asset: findAsset(rel, buildenv),
      }))
      .filter((ch) => ch.asset) // only channels with a build for this device
  })

  let hasUpdate = $derived(
    channels().some(
      (ch) => ch.key === 'release' && updateAvailable(ch.version, installed),
    ),
  )

  onMount(async () => {
    releases = await fetchReleases()
  })

  async function installOnline(asset) {
    if (uploading) return
    uploading = true
    serialQueue.pause()
    try {
      const res = await serialQueue.add(() =>
        httpAPI('POST', '/update', JSON.stringify({ url: asset.browser_download_url })),
      )
      if (!res || res === 'error') showWriteError()
    } finally {
      serialQueue.resume()
      uploading = false
    }
  }
```

Note: `installOnline` calls `serialQueue.add` while the queue is paused — that is the
same pattern as the existing `uploadFirmware`; the queued task runs once `resume()` is
reached. To keep it simple and correct, **do not pause** for the online install (the
device fetches the firmware itself; no long client upload). Use:

```js
  async function installOnline(asset) {
    if (uploading) return
    uploading = true
    try {
      const res = await serialQueue.add(() =>
        httpAPI('POST', '/update', JSON.stringify({ url: asset.browser_download_url })),
      )
      if (!res || res === 'error') showWriteError()
    } finally {
      uploading = false
    }
  }
```

- [ ] **Step 2: Add the "Online updates" `ConfigSection`** to the template, immediately
after the `config.firmware.versions` section:

```svelte
  <ConfigSection title={$_('config.firmware.online')}>
    {#if releases === null}
      <p class="py-2 text-sm text-text-dim">{$_('config.firmware.checking')}</p>
    {:else if channels().length === 0}
      <p class="py-2 text-sm text-text-dim">{$_('config.firmware.github_error')}</p>
    {:else}
      {#if hasUpdate}
        <p class="mb-1 text-sm text-accent">{$_('config.firmware.update_found')}</p>
      {:else}
        <p class="mb-1 text-sm text-text-dim">{$_('config.firmware.up_to_date')}</p>
      {/if}
      {#each channels() as ch}
        <div class="flex items-center gap-3 py-2 text-sm">
          <span class="flex-1 text-text">
            {$_('config.firmware.channel_' + ch.key)}
            <span class="text-text-dim">· {ch.version}</span>
          </span>
          <Button
            label={$_('config.firmware.install_online')}
            variant="ghost"
            disabled={uploading}
            onclick={() => installOnline(ch.asset)}
          />
        </div>
      {/each}
    {/if}
  </ConfigSection>
```

- [ ] **Step 3: Extend `Firmware.test.js`.** Add — at the top, after the httpAPI mock,
mock `fetchReleases` by stubbing global `fetch`, OR mock the firmware module. Simplest:
stub `global.fetch` in a test. Add:

```js
  it('shows the loading state then the channels from GitHub', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { tag_name: 'v9.9.9', name: 'v9.9.9', prerelease: false, assets: [
              { name: 'adafruit_featheresp32.bin', browser_download_url: 'u' },
            ] },
          ]),
      }),
    )
    config_store.set({ firmware: '7.1.3', version: 'v1.0.0', buildenv: 'adafruit_featheresp32' })
    const { getByText } = render(Firmware)
    await vi.waitFor(() => {
      expect(getByText('config.firmware.channel_release')).toBeInTheDocument()
    })
  })
```

(Confirm the `buildenv` value matches `dev/fixtures/config.json` so the asset matches.)

- [ ] **Step 4: Run** `npx vitest run src/routes/settings/__tests__/Firmware.test.js` — PASS.
- [ ] **Step 5: Commit** — `git commit -m "Add GitHub online updates to the Firmware page"`

---

## Task 5: Tesla helper — `src/lib/config/tesla.js`

**Files:** Create `src/lib/config/tesla.js`, `src/lib/config/__tests__/tesla.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/config/__tests__/tesla.test.js
import { describe, it, expect } from 'vitest'
import { hasTeslaCredentials } from '../tesla.js'

describe('hasTeslaCredentials', () => {
  const full = {
    tesla_access_token: 'a', tesla_refresh_token: 'r',
    tesla_created_at: 1700000000, tesla_expires_in: 3600,
  }
  it('is true when all four credential fields are present', () => {
    expect(hasTeslaCredentials(full)).toBe(true)
  })
  it('is false when any field is empty / zero / missing', () => {
    expect(hasTeslaCredentials({ ...full, tesla_access_token: '' })).toBe(false)
    expect(hasTeslaCredentials({ ...full, tesla_expires_in: 0 })).toBe(false)
    expect(hasTeslaCredentials({ ...full, tesla_refresh_token: false })).toBe(false)
    expect(hasTeslaCredentials({})).toBe(false)
    expect(hasTeslaCredentials(undefined)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```js
// src/lib/config/tesla.js
// Whether the device config holds a usable set of Tesla API credentials.

function present(v) {
  return v !== undefined && v !== null && v !== '' && v !== false && v !== 0
}

export function hasTeslaCredentials(config) {
  if (!config) return false
  return (
    present(config.tesla_access_token) &&
    present(config.tesla_refresh_token) &&
    present(config.tesla_created_at) &&
    present(config.tesla_expires_in)
  )
}
```

- [ ] **Step 4: Run it — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the Tesla-credentials helper"`

---

## Task 6: Vehicle page — Tesla login flow

Replace the Tesla (`src === 1`) block in `src/routes/settings/Vehicle.svelte` with the
full login flow: a login form when logged out, the vehicle picker + logout when
logged in, and the manual token fields behind an "Advanced" disclosure.

**Files:** Modify `Vehicle.svelte`; extend `Vehicle.test.js`.

- [ ] **Step 1: Extend the `<script>`.** Add imports:

```js
  import { onMount } from 'svelte'
  import { serialQueue } from '../../lib/queue.js'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import { showWriteError } from '../../lib/alerts.js'
  import { hasTeslaCredentials } from '../../lib/config/tesla.js'
  import Button from '../../lib/components/ui/Button.svelte'
```

Add state + logic (after `unitOptions`):

```js
  const TESLA_LOGIN_URL = 'https://auth.openevse.com/login'

  let loggedIn = $derived(hasTeslaCredentials($config_store))

  // login form (Tesla account credentials — not stored anywhere)
  let teslaUser = $state('')
  let teslaPass = $state('')
  let loggingIn = $state(false)
  let loginFailed = $state(false)
  let advancedOpen = $state(false)

  // vehicle list
  let vehicles = $state([])
  let vehiclesError = $state(false)

  $effect(() => {
    if (src === 1 && loggedIn) loadVehicles()
  })

  async function loadVehicles() {
    vehiclesError = false
    const res = await serialQueue.add(() => httpAPI('GET', '/tesla/vehicles'))
    if (!res || res === 'error' || !Array.isArray(res.vehicles)) {
      vehiclesError = true
      vehicles = []
      return
    }
    vehicles = res.vehicles
  }

  async function teslaLogin() {
    if (loggingIn || !teslaUser || !teslaPass) return
    loggingIn = true
    loginFailed = false
    const res = await serialQueue.add(() =>
      httpAPI('POST', TESLA_LOGIN_URL, JSON.stringify({ username: teslaUser, password: teslaPass })),
    )
    loggingIn = false
    if (res && res !== 'error' && res.ok) {
      teslaUser = ''
      teslaPass = ''
      const ok = await form.saveFields({
        tesla_enabled: true,
        tesla_access_token: res.access_token,
        tesla_refresh_token: res.refresh_token,
        tesla_created_at: res.created_at,
        tesla_expires_in: res.expires_in,
      })
      if (!ok) showWriteError()
    } else {
      loginFailed = true
    }
  }

  function teslaLogout() {
    vehicles = []
    return form.saveFields({
      tesla_enabled: false,
      tesla_access_token: '',
      tesla_refresh_token: '',
      tesla_created_at: '',
      tesla_expires_in: '',
    })
  }

  let vehicleOptions = $derived(vehicles.map((v) => ({ value: String(v.id), label: v.name })))
```

- [ ] **Step 2: Replace the `{#if src === 1}` block** in the template. The new block:

```svelte
  {#if src === 1}
    <ConfigSection title={$_('config.vehicle.src_tesla')}>
      <FormField label={$_('config.vehicle.range_unit')} status={$ss.mqtt_vehicle_range_miles ?? 'idle'}>
        <Select
          options={unitOptions}
          value={String(!!$config_store?.mqtt_vehicle_range_miles)}
          onchange={(v) => form.saveField('mqtt_vehicle_range_miles', v === 'true')}
        />
      </FormField>

      {#if loggedIn}
        <FormField label={$_('config.vehicle.select_vehicle')} status={$ss.tesla_vehicle_id ?? 'idle'}>
          {#if vehiclesError}
            <p class="text-sm text-error">{$_('config.vehicle.no_vehicles')}</p>
          {:else if vehicleOptions.length > 0}
            <Select
              options={vehicleOptions}
              value={String($config_store?.tesla_vehicle_id ?? '')}
              onchange={(v) => form.saveField('tesla_vehicle_id', v)}
            />
          {:else}
            <p class="text-sm text-text-dim">{$_('config.vehicle.fetching_vehicles')}</p>
          {/if}
        </FormField>
        <div class="py-2">
          <Button label={$_('config.vehicle.logout')} variant="ghost" onclick={teslaLogout} />
        </div>
      {:else}
        <p class="mb-2 text-xs text-text-dim">{$_('config.vehicle.via_openevse')}</p>
        <FormField label={$_('config.vehicle.username')}>
          <input
            type="text"
            aria-label={$_('config.vehicle.username')}
            value={teslaUser}
            oninput={(e) => (teslaUser = e.currentTarget.value)}
            class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm
                   text-text focus:border-accent focus:outline-none"
          />
        </FormField>
        <FormField label={$_('config.vehicle.password')}>
          <input
            type="password"
            aria-label={$_('config.vehicle.password')}
            value={teslaPass}
            oninput={(e) => (teslaPass = e.currentTarget.value)}
            class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm
                   text-text focus:border-accent focus:outline-none"
          />
        </FormField>
        {#if loginFailed}
          <p class="text-sm text-error">{$_('config.vehicle.login_failed')}</p>
        {/if}
        <div class="py-2">
          <Button
            label={loggingIn ? $_('config.vehicle.logging_in') : $_('config.vehicle.login')}
            disabled={loggingIn || !teslaUser || !teslaPass}
            onclick={teslaLogin}
          />
        </div>

        <button
          type="button"
          onclick={() => (advancedOpen = !advancedOpen)}
          class="mt-1 text-xs text-text-dim hover:text-text"
        >
          {$_('config.vehicle.advanced')}
        </button>
        {#if advancedOpen}
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
        {/if}
      {/if}
    </ConfigSection>
  {:else if src === 2}
```

(The `{:else if src === 2}` and `{:else if src === 3}` blocks below are unchanged.)

- [ ] **Step 3: Extend `Vehicle.test.js`.** Replace the old Tesla test with:

```js
  it('shows the Tesla login form when logged out', () => {
    config_store.set({ vehicle_data_src: 1 })
    const { getByText } = render(Vehicle)
    expect(getByText('config.vehicle.login')).toBeInTheDocument()
  })

  it('reveals the manual token fields under Advanced', async () => {
    config_store.set({ vehicle_data_src: 1 })
    const { getByText, queryByText } = render(Vehicle)
    expect(queryByText('config.vehicle.access_token')).not.toBeInTheDocument()
    await fireEvent.click(getByText('config.vehicle.advanced'))
    expect(getByText('config.vehicle.access_token')).toBeInTheDocument()
  })

  it('shows the vehicle picker and logout when credentials are present', async () => {
    httpAPI.mockImplementation((m, url) =>
      url === '/tesla/vehicles'
        ? Promise.resolve({ count: 1, vehicles: [{ id: 'v1', name: 'My Tesla' }] })
        : Promise.resolve({ msg: 'done' }),
    )
    config_store.set({
      vehicle_data_src: 1,
      tesla_access_token: 'a', tesla_refresh_token: 'r',
      tesla_created_at: 1700000000, tesla_expires_in: 3600,
    })
    const { getByText } = render(Vehicle)
    expect(getByText('config.vehicle.logout')).toBeInTheDocument()
    await vi.waitFor(() => expect(getByText('config.vehicle.select_vehicle')).toBeInTheDocument())
  })
```

(Keep the existing MQTT / HTTP / None tests. The old `it('shows Tesla token fields…')`
test asserted the tokens are always visible — remove it; the new tests replace it.)

- [ ] **Step 4: Run** `npx vitest run src/routes/settings/__tests__/Vehicle.test.js` — PASS.
- [ ] **Step 5: Commit** — `git commit -m "Add the Tesla login flow to the Vehicle page"`

---

## Task 7: Mock routes & fixtures

**Files:** Create `dev/fixtures/scan.json`, `dev/fixtures/tesla-vehicles.json`; modify
`dev/mock-plugin.js`.

- [ ] **Step 1: Create `dev/fixtures/scan.json`**

```json
[
  { "ssid": "HomeNetwork", "rssi": -43, "encryption": "wpa2" },
  { "ssid": "Neighbour 5G", "rssi": -67, "encryption": "wpa2" },
  { "ssid": "CoffeeShop", "rssi": -78, "encryption": "open" },
  { "ssid": "HomeNetwork", "rssi": -55, "encryption": "wpa2" }
]
```

- [ ] **Step 2: Create `dev/fixtures/tesla-vehicles.json`**

```json
{ "count": 2, "vehicles": [
  { "id": "1492931576", "name": "Model 3" },
  { "id": "8830012245", "name": "Model Y" }
] }
```

- [ ] **Step 3: Add the mock routes** to `dev/mock-plugin.js`. In the HTTP middleware,
alongside the other dynamic routes (e.g. near `/api/rfid/add`), add:

```js
        if (url === '/api/scan' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(loadFixture('scan.json'))
          return
        }

        if (url === '/api/tesla/vehicles' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(loadFixture('tesla-vehicles.json'))
          return
        }
```

- [ ] **Step 4: Verify** — `npm run dev:mock` starts cleanly (or `npm run build`
succeeds). Commit — `git commit -m "Add mock routes for WiFi scan and Tesla vehicles"`

---

## Task 8: i18n strings

Add the new keys to **all four** locale files. For `en.json` use the English below;
for `es/fr/hu` translate them in the same style as the existing entries in each file.

**Files:** Modify `src/lib/i18n/{en,es,fr,hu}.json`.

- [ ] **Step 1: Add to `config.network`** (alongside its existing keys):

```json
"wifi": "WiFi network",
"scan": "Scan for networks",
"scanning": "Scanning…",
"scan_error": "Couldn't scan for networks.",
"wifi_password": "WiFi password",
"connect": "Connect",
"connecting_btn": "Connecting…",
"connecting": "Connecting — the charger will rejoin your network. You may need to reload this page at its new address."
```

- [ ] **Step 2: Add to `config.firmware`**:

```json
"online": "Online updates",
"checking": "Checking GitHub…",
"github_error": "No build for this device, or GitHub is unreachable.",
"update_found": "An update is available.",
"up_to_date": "You're on the latest stable release.",
"channel_release": "Stable",
"channel_prerelease": "Pre-release",
"channel_daily": "Development",
"install_online": "Install"
```

- [ ] **Step 3: Add to `config.vehicle`**:

```json
"via_openevse": "Login goes through OpenEVSE's server, which performs the Tesla sign-in. Or open Advanced to paste API tokens directly.",
"username": "Tesla account email",
"password": "Tesla account password",
"login": "Log in",
"logging_in": "Logging in…",
"logout": "Log out",
"login_failed": "Login failed. Check your credentials.",
"advanced": "Advanced — enter tokens manually",
"select_vehicle": "Vehicle",
"fetching_vehicles": "Fetching vehicles…",
"no_vehicles": "Couldn't load your vehicles."
```

- [ ] **Step 4:** Translate the same keys into `es.json`, `fr.json`, `hu.json` (same
structure, translated values; keep ICU placeholders — none here — and brand terms
like OpenEVSE, Tesla, WiFi, GitHub untranslated).

- [ ] **Step 5: Verify** each locale file is valid JSON and the locale-parity test
passes: `npx vitest run src/lib/i18n/__tests__/locale-parity.test.js`. Then full
`npm test` and `npm run build`.

- [ ] **Step 6: Commit** — `git commit -m "Add i18n strings for the deferred features"`

---

## Verification gate (before merge)

- [ ] `npm test` — all pass (incl. the locale-parity test).
- [ ] `npm run build` — succeeds; assets gzipped.
- [ ] Playwright check — `npm run dev:mock`: on `/#/settings/network` a scan lists
      networks; on `/#/settings/vehicle` with Tesla selected the login form shows;
      on `/#/settings/firmware` the online-updates section loads (it will reach the
      real GitHub API). No console/page errors.

## On completion

Hand off to `superpowers:finishing-a-development-branch` to merge `deferred-features`
to `main`.
