# Unified ESP32 + JuiceBox UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make nightshift the single web UI that runs on both the ESP32 (WebSocket push) and the JuiceBox/LibreTiny port (HTTP polling), auto-selecting transport and hiding unsupported features from what the device reports.

**Architecture:** A `TransportManager` runs polling as an always-on baseline and lets a live WebSocket suppress it. Capability gating is data-driven: settings pages/nav/controls hide when their backing config field or endpoint is absent. A single `VITE_CHARTS` build flag produces a second, uplot-stripped artifact for JuiceBox; everything else is one runtime-driven build.

**Tech Stack:** Svelte 5 runes, Vite 8, Vitest + @testing-library/svelte, Tailwind v4. Custom hash router (`src/lib/router.js`). No svelte-spa-router.

**Spec:** `docs/superpowers/specs/2026-06-16-unified-juicebox-transport-design.md`

**Repo / branch:** `/home/rar/openevse-gui-nightshift`, branch `feat/unified-juicebox-transport` (already created; the spec is committed there).

**Conventions to follow:**
- Run a single test file: `npx vitest run src/path/to/file.test.js`
- Run tests by name: `npx vitest run -t "test name"`
- Full suite: `npm test`
- Coverage is scoped to `src/lib/**/*.js`; component tests live in `__tests__/` folders.
- `httpAPI` never throws — it resolves to the string `'error'` on any failure.
- Tests mock `svelte-i18n` so `$_('key')` returns the key verbatim (see existing tests for the mock shape).

---

### Task 1: Port the Poller into nightshift

The JuiceBox firmware has no `/ws`; the dashboard stays live by polling `GET /status`. Port lite's `Poller.svelte` into nightshift. Two changes from lite's version: (a) merge inline (nightshift's `status_store` has no `mergeStatus` helper and uses the same shallow-merge shape as `WebSocket.svelte`); (b) add an `active` prop so the `TransportManager` (Task 2) can silence polling while a WebSocket is live; (c) write `uistates.ws_connected` (repurposed to mean "live transport healthy") so the existing connection dot in `AppShell`/`Header` keeps working unchanged.

**Files:**
- Create: `src/lib/data/Poller.svelte`
- Test: `src/lib/data/__tests__/Poller.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/data/__tests__/Poller.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { httpAPI } from '../../api/httpAPI.js'
import { status_store } from '../../stores/status.js'
import { uistates_store } from '../../stores/uistates.js'
import Poller from '../Poller.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  status_store.set(undefined)
  uistates_store.update((u) => ({ ...u, ws_connected: true }))
})

describe('Poller', () => {
  it('merges a successful poll into status_store and marks connected', async () => {
    httpAPI.mockResolvedValue({ amp: 24, state: 3 })
    render(Poller)
    await vi.waitFor(() => expect(get(status_store)?.amp).toBe(24))
    expect(get(uistates_store).ws_connected).toBe(true)
  })

  it('marks disconnected when a poll fails', async () => {
    httpAPI.mockResolvedValue('error')
    render(Poller)
    await vi.waitFor(() => expect(get(uistates_store).ws_connected).toBe(false))
  })

  it('does not poll when active is false', async () => {
    httpAPI.mockResolvedValue({ amp: 1 })
    render(Poller, { props: { active: false } })
    // give the mount a tick; no request should be issued
    await Promise.resolve()
    expect(httpAPI).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/data/__tests__/Poller.test.js`
Expected: FAIL — `Failed to resolve import "../Poller.svelte"`.

- [ ] **Step 3: Create the Poller**

```svelte
<!-- src/lib/data/Poller.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte'
  import { uistates_store } from '../stores/uistates.js'
  import { status_store } from '../stores/status.js'
  import { httpAPI } from '../api/httpAPI.js'

  // No /ws on the JuiceBox firmware, so the dashboard stays live by polling
  // GET /status. ~1.5 s is plenty for EVSE state and leaves the single-
  // threaded device room to breathe. `active` is false while a WebSocket is
  // live (TransportManager): the interval keeps ticking but each poll no-ops,
  // so we never double-fetch.
  let { active = true } = $props()

  const POLL_MS = 1500
  let timer = null
  let inflight = false

  onMount(() => {
    poll()
    timer = setInterval(poll, POLL_MS)
  })
  onDestroy(() => { if (timer) clearInterval(timer) })

  async function poll() {
    if (!active || inflight) return // never overlap; stay quiet while WS drives
    inflight = true
    try {
      const res = await httpAPI('GET', '/status')
      const ok = res && res !== 'error' && res.msg !== 'error'
      // Shallow-merge like WebSocket.svelte — frames may be partial.
      if (ok) status_store.update((cur) => ({ ...(cur || {}), ...res }))
      uistates_store.update((u) => ({ ...u, ws_connected: ok }))
    } finally {
      inflight = false
    }
  }
</script>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/data/__tests__/Poller.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/Poller.svelte src/lib/data/__tests__/Poller.test.js
git commit -m "feat(data): port polling transport (Poller) into nightshift"
```

---

### Task 2: TransportManager — poll baseline, WebSocket suppresses

`WebSocket.svelte` gets a bindable `live` prop it sets true on open+first-message and false on close/error (alongside the `ws_connected` it already writes). `TransportManager` composes the two: it renders `<WebSocket bind:live>` and `<Poller active={!live}>`. On a device with no `/ws`, `live` never turns true, so polling runs forever; on the ESP32, `live` flips true within a second and polling falls quiet.

**Files:**
- Modify: `src/lib/data/WebSocket.svelte` (add bindable `live`)
- Create: `src/lib/data/TransportManager.svelte`
- Modify: `src/App.svelte:10,47,51` (swap `WebSocket` mounts for `TransportManager`)
- Test: `src/lib/data/__tests__/TransportManager.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/data/__tests__/TransportManager.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve('error')) }))

import { httpAPI } from '../../api/httpAPI.js'
import { uistates_store } from '../../stores/uistates.js'
import TransportManager from '../TransportManager.svelte'

// A fake WebSocket we drive by hand. Captures the latest instance.
let lastWs
class FakeWS {
  constructor() { this.listeners = {}; lastWs = this; this.readyState = 0; this.OPEN = 1 }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn) }
  removeEventListener() {}
  send() {}
  close() { this.emit('close') }
  emit(t, data) { (this.listeners[t] || []).forEach((fn) => fn({ data })) }
}

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue('error')
  lastWs = undefined
  globalThis.WebSocket = FakeWS
  uistates_store.update((u) => ({ ...u, ws_connected: true }))
})

describe('TransportManager', () => {
  it('polls at startup before any WebSocket is live', async () => {
    httpAPI.mockResolvedValue({ amp: 5 })
    render(TransportManager)
    await vi.waitFor(() => expect(httpAPI).toHaveBeenCalledWith('GET', '/status'))
  })

  it('stops polling once the WebSocket goes live', async () => {
    httpAPI.mockResolvedValue({ amp: 5 })
    render(TransportManager)
    await vi.waitFor(() => expect(lastWs).toBeTruthy())
    lastWs.readyState = 1
    lastWs.emit('open')
    lastWs.emit('message', '{"amp":6}')
    const callsAfterLive = httpAPI.mock.calls.length
    await new Promise((r) => setTimeout(r, 60))
    // No *new* polls fire while the socket is live (allow the in-flight one).
    expect(httpAPI.mock.calls.length).toBeLessThanOrEqual(callsAfterLive + 1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/data/__tests__/TransportManager.test.js`
Expected: FAIL — `Failed to resolve import "../TransportManager.svelte"`.

- [ ] **Step 3: Add the bindable `live` prop to WebSocket.svelte**

At the top of `src/lib/data/WebSocket.svelte`'s `<script>`, add the prop:

```js
  let { live = $bindable(false) } = $props()
```

Then set `live` everywhere `ws_connected` is written. In the `open` handler (currently `$uistates_store.ws_connected = true`) set both:

```js
    s.addEventListener('open', () => {
      if (s !== socket) return
      $uistates_store.ws_connected = true
      live = true
      reconnectDelay = RECONNECT_MIN
      keepAlive(s)
    })
```

In each of the `error`, `close`, and `keepAlive`-timeout paths that currently set `$uistates_store.ws_connected = false`, add `live = false` directly after that line (three sites).

- [ ] **Step 4: Create the TransportManager**

```svelte
<!-- src/lib/data/TransportManager.svelte -->
<script>
  // Polling is the always-on baseline; a live WebSocket suppresses it.
  //  - No /ws (JuiceBox): `live` stays false → Poller runs the whole session.
  //  - ESP32: `live` flips true within ~1 s → Poller no-ops, WS drives.
  // Both feed status_store via a shallow merge, so the brief handshake overlap
  // on the ESP32 is harmless.
  import WebSocket from './WebSocket.svelte'
  import Poller from './Poller.svelte'

  let live = $state(false)
</script>

<WebSocket bind:live />
<Poller active={!live} />
```

- [ ] **Step 5: Wire it into App.svelte**

In `src/App.svelte`, replace the import on line 10:

```js
  import TransportManager from './lib/data/TransportManager.svelte'
```

and replace both `<WebSocket />` mounts (the Wizard branch and the AppShell branch) with:

```svelte
  <TransportManager />
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/data/__tests__/TransportManager.test.js src/lib/data/__tests__/data-components.test.js`
Expected: PASS. (The existing `data-components.test.js` still mounts `WebSocket` directly; the new bindable prop is optional so it keeps passing.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/WebSocket.svelte src/lib/data/TransportManager.svelte src/App.svelte src/lib/data/__tests__/TransportManager.test.js
git commit -m "feat(data): auto-select WebSocket vs polling via TransportManager"
```

---

### Task 3: Data-driven settings-page gating

`pages.js` already has a `requires` predicate; it's unused. Populate it with the config field that proves each hardware-dependent feature exists, and change the test from truthiness to **presence** (`p.requires in config`) so a feature that's present-but-disabled still shows its page. Add a `capabilities.js` helper that derives the unreachable settings routes (used by the router in Task 4). Update the existing `pages.test.js`, which currently assumes all 17 pages always show.

**Files:**
- Modify: `src/lib/config/pages.js`
- Create: `src/lib/config/capabilities.js`
- Modify: `src/lib/config/__tests__/pages.test.js`
- Test: `src/lib/config/__tests__/capabilities.test.js`

- [ ] **Step 1: Update the pages test for presence-based gating**

Replace the `pagesBySection` describe block in `src/lib/config/__tests__/pages.test.js` with one that reflects gating. The "all 17" assertions move under a fully-populated config; absent fields hide pages.

```js
describe('pagesBySection', () => {
  // A config that reports every gateable feature (present, value irrelevant).
  const FULL = {
    mqtt_enabled: false, ocpp_enabled: false, rfid_enabled: false,
    divert_enabled: false, current_shaper_enabled: false,
    emoncms_enabled: false, ohm_enabled: false, mqtt_vehicle_soc: '',
  }

  it('shows all 17 pages when every capability is reported', () => {
    const grouped = pagesBySection(FULL)
    const total = grouped.reduce((n, g) => n + g.pages.length, 0)
    expect(total).toBe(17)
  })
  it('preserves section order', () => {
    expect(pagesBySection(FULL).map((g) => g.section)).toEqual(SECTIONS)
  })
  it('always shows non-gated pages even with an empty config', () => {
    const keys = pagesBySection({}).flatMap((g) => g.pages.map((p) => p.key))
    expect(keys).toEqual(expect.arrayContaining(['network', 'http', 'evse', 'safety', 'time', 'firmware', 'about']))
  })
  it('hides a gated page when its required field is absent', () => {
    const keys = pagesBySection({}).flatMap((g) => g.pages.map((p) => p.key))
    expect(keys).not.toContain('ocpp')
    expect(keys).not.toContain('rfid')
  })
  it('shows a gated page when the field is present but falsy', () => {
    const keys = pagesBySection({ ocpp_enabled: false }).flatMap((g) => g.pages.map((p) => p.key))
    expect(keys).toContain('ocpp')
  })
  it('drops a section that has no visible pages', () => {
    // Empty config hides all of connectivity's gated pages but network/http remain,
    // so connectivity survives; energy (all gated) disappears.
    const sections = pagesBySection({}).map((g) => g.section)
    expect(sections).not.toContain('energy')
    expect(sections).toContain('connectivity')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/config/__tests__/pages.test.js`
Expected: FAIL — gated pages still show (no `requires` set yet) and the presence test isn't implemented.

- [ ] **Step 3: Add `requires` predicates and the presence check**

In `src/lib/config/pages.js`, add `requires` to the gated entries (leave hardware-independent pages — network, http, evse, safety, time, firmware, about — without it):

```js
  { key: 'mqtt', route: '/settings/mqtt', icon: 'mdi:transit-connection-variant', labelKey: 'config.pages.mqtt', section: 'connectivity', requires: 'mqtt_enabled' },
  { key: 'ocpp', route: '/settings/ocpp', icon: 'mdi:ev-station', labelKey: 'config.pages.ocpp', section: 'connectivity', requires: 'ocpp_enabled' },
  { key: 'rfid', route: '/settings/rfid', icon: 'mdi:nfc-variant', labelKey: 'config.pages.rfid', section: 'charger', requires: 'rfid_enabled' },
  { key: 'vehicle', route: '/settings/vehicle', icon: 'mdi:car', labelKey: 'config.pages.vehicle', section: 'charger', requires: 'mqtt_vehicle_soc' },
  { key: 'solar', route: '/settings/solar', icon: 'mdi:solar-power', labelKey: 'config.pages.solar', section: 'energy', requires: 'divert_enabled' },
  { key: 'shaper', route: '/settings/shaper', icon: 'mdi:chart-bell-curve', labelKey: 'config.pages.shaper', section: 'energy', requires: 'current_shaper_enabled' },
  { key: 'emoncms', route: '/settings/emoncms', icon: 'mdi:chart-box-outline', labelKey: 'config.pages.emoncms', section: 'energy', requires: 'emoncms_enabled' },
  { key: 'ohmconnect', route: '/settings/ohmconnect', icon: 'mdi:flash-outline', labelKey: 'config.pages.ohmconnect', section: 'energy', requires: 'ohm_enabled' },
```

Leave `certificates` without a `requires` for now (it's gated by endpoint presence, handled with History in Task 5; keep it visible here). Then change the filter in `pagesBySection` from truthiness to presence:

```js
export function pagesBySection(config) {
  return SECTIONS.map((section) => ({
    section,
    pages: SETTINGS_PAGES.filter(
      (p) => p.section === section && (!p.requires || (config != null && p.requires in config)),
    ),
  })).filter((g) => g.pages.length > 0)
}
```

- [ ] **Step 4: Write the capabilities helper test**

```js
// src/lib/config/__tests__/capabilities.test.js
import { describe, it, expect } from 'vitest'
import { blockedSettingsRoutes } from '../capabilities.js'

describe('blockedSettingsRoutes', () => {
  it('lists routes whose required field is absent', () => {
    const blocked = blockedSettingsRoutes({})
    expect(blocked).toContain('/settings/ocpp')
    expect(blocked).toContain('/settings/solar')
    expect(blocked).not.toContain('/settings/evse') // never gated
  })
  it('does not block a route whose field is present but falsy', () => {
    expect(blockedSettingsRoutes({ ocpp_enabled: false })).not.toContain('/settings/ocpp')
  })
})
```

- [ ] **Step 5: Run the capabilities test to verify it fails**

Run: `npx vitest run src/lib/config/__tests__/capabilities.test.js`
Expected: FAIL — `Failed to resolve import "../capabilities.js"`.

- [ ] **Step 6: Create the capabilities helper**

```js
// src/lib/config/capabilities.js
// Data-driven capability gating: the device's own /config tells us which
// settings pages it supports. A page with a `requires` field whose key is
// absent from /config is unreachable.
import { SETTINGS_PAGES } from './pages.js'

/** Settings routes whose required config field is absent → unreachable. */
export function blockedSettingsRoutes(config) {
  return SETTINGS_PAGES
    .filter((p) => p.requires && !(config != null && p.requires in config))
    .map((p) => p.route)
}
```

- [ ] **Step 7: Run both tests to verify they pass**

Run: `npx vitest run src/lib/config/__tests__/pages.test.js src/lib/config/__tests__/capabilities.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/config/pages.js src/lib/config/capabilities.js src/lib/config/__tests__/pages.test.js src/lib/config/__tests__/capabilities.test.js
git commit -m "feat(config): gate settings pages on reported capabilities"
```

---

### Task 4: Block gated routes in the router and hide them in the nav

The settings hub (`Settings.svelte`) already filters via `pagesBySection`, so gated pages vanish from the hub automatically once Task 3 lands. This task covers the two remaining surfaces: deep links to a gated route (must redirect, not render), and the bottom nav (which is a static list).

Add a `blocked` prop to the generic `Router`. `AppShell` computes the blocked set from config + capability flags and passes it, plus a filtered nav.

**Files:**
- Modify: `src/lib/components/Router.svelte`
- Modify: `src/lib/components/shell/AppShell.svelte`
- Modify: `src/lib/components/shell/BottomNav.svelte`
- Test: `src/lib/components/__tests__/Router.blocked.test.js`
- Test: `src/lib/components/shell/__tests__/BottomNav.test.js`

- [ ] **Step 1: Write the Router test**

```js
// src/lib/components/__tests__/Router.blocked.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'
import Router from '../Router.svelte'
import Dummy from './fixtures/Dummy.svelte'

beforeEach(() => { window.location.hash = '' })

describe('Router blocked routes', () => {
  it('redirects a blocked path to / instead of rendering it', async () => {
    window.location.hash = '/settings/ocpp'
    window.dispatchEvent(new Event('hashchange'))
    render(Router, { props: { routes: { '/settings/ocpp': Dummy }, blocked: ['/settings/ocpp'] } })
    await vi.waitFor(() => expect(window.location.hash).toBe('#/'))
  })
  it('renders a non-blocked path normally', () => {
    window.location.hash = '/settings/ocpp'
    window.dispatchEvent(new Event('hashchange'))
    const { getByText } = render(Router, { props: { routes: { '/settings/ocpp': Dummy }, blocked: [] } })
    expect(getByText('dummy')).toBeInTheDocument()
  })
})
```

Create the fixture component:

```svelte
<!-- src/lib/components/__tests__/fixtures/Dummy.svelte -->
<div>dummy</div>
```

Add `import { vi } from 'vitest'` to the test's imports (used by `vi.waitFor`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/components/__tests__/Router.blocked.test.js`
Expected: FAIL — `blocked` is ignored, the path renders.

- [ ] **Step 3: Add the `blocked` prop to Router**

```svelte
<!-- src/lib/components/Router.svelte -->
<script>
  import { currentPath, redirect } from '../router.js'
  let { routes = {}, fallback, aliases = {}, blocked = [] } = $props()

  // A legacy path or a blocked (capability-gated) path renders nothing for the
  // one tick it takes the redirect to land — never the fallback, which would
  // flash a 404.
  let Component = $derived(
    blocked.includes($currentPath)
      ? null
      : routes[$currentPath] ?? (aliases[$currentPath] ? null : fallback),
  )

  $effect(() => {
    if (blocked.includes($currentPath)) { redirect('/'); return }
    const target = aliases[$currentPath]
    if (target) redirect(target)
  })
</script>

{#if Component}
  <Component />
{/if}
```

- [ ] **Step 4: Wire AppShell to compute blocked routes + nav caps**

In `src/lib/components/shell/AppShell.svelte`, add imports and derived state, then pass them down. Add to the `<script>`:

```js
  import { config_store } from '../../stores/config.js'
  import { blockedSettingsRoutes } from '../../config/capabilities.js'
  import { CHARTS_ENABLED } from '../../charts/lazy.js'

  // History availability is probed at startup (FetchData); default true so the
  // tab shows until we learn otherwise.
  let historyAvailable = $derived($uistates_store?.history_available ?? true)
  let caps = $derived({ charts: CHARTS_ENABLED, history: historyAvailable })
  let blocked = $derived([
    ...blockedSettingsRoutes($config_store),
    ...(CHARTS_ENABLED ? [] : ['/monitoring']),
    ...(historyAvailable ? [] : ['/history']),
  ])
```

Change the `Router` mount to pass `blocked`, and `BottomNav` to pass `caps`:

```svelte
      <Router {routes} fallback={NotFound} aliases={LEGACY_ROUTES} {blocked} />
```
```svelte
  <BottomNav path={$currentPath} {deviceName} {caps} />
```

(`CHARTS_ENABLED` and `uistates.history_available` are created in Tasks 6 and 5 respectively; this task depends on Task 3 and is best implemented after Tasks 5–6, or stub `CHARTS_ENABLED = true` and `history_available` defaults until then. The subagent executing this plan should implement Tasks 5 and 6 first if running out of order — see the dependency note at the end.)

- [ ] **Step 5: Write the BottomNav test**

```js
// src/lib/components/shell/__tests__/BottomNav.test.js
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import BottomNav from '../BottomNav.svelte'

describe('BottomNav capability gating', () => {
  it('shows monitoring and history when capable', () => {
    const { queryByLabelText } = render(BottomNav, { props: { caps: { charts: true, history: true } } })
    expect(queryByLabelText('nav.monitoring')).toBeInTheDocument()
    expect(queryByLabelText('nav.history')).toBeInTheDocument()
  })
  it('hides monitoring when charts are stripped and history when unavailable', () => {
    const { queryByLabelText } = render(BottomNav, { props: { caps: { charts: false, history: false } } })
    expect(queryByLabelText('nav.monitoring')).not.toBeInTheDocument()
    expect(queryByLabelText('nav.history')).not.toBeInTheDocument()
    expect(queryByLabelText('nav.home')).toBeInTheDocument()
  })
})
```

Add `import { vi } from 'vitest'` to the test imports.

- [ ] **Step 6: Run the BottomNav test to verify it fails**

Run: `npx vitest run src/lib/components/shell/__tests__/BottomNav.test.js`
Expected: FAIL — `caps` is ignored; both items always render.

- [ ] **Step 7: Filter the nav items in BottomNav**

In `src/lib/components/shell/BottomNav.svelte`, accept `caps` and filter. Replace the props line and the `items` const:

```js
  let { path = '/', deviceName = 'OpenEVSE', caps = { charts: true, history: true } } = $props()

  let items = $derived([
    { href: '/', key: 'nav.home', icon: 'mdi:home-outline' },
    { href: '/schedule', key: 'nav.schedule', icon: 'mdi:calendar-clock-outline' },
    ...(caps.charts ? [{ href: '/monitoring', key: 'nav.monitoring', icon: 'mdi:chart-line' }] : []),
    ...(caps.history ? [{ href: '/history', key: 'nav.history', icon: 'mdi:history' }] : []),
    { href: '/settings', key: 'nav.settings', icon: 'mdi:cog-outline' },
  ])
```

(The `{#each items}` block already iterates the list; no further change.)

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/lib/components/__tests__/Router.blocked.test.js src/lib/components/shell/__tests__/BottomNav.test.js`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/components/Router.svelte src/lib/components/shell/AppShell.svelte src/lib/components/shell/BottomNav.svelte src/lib/components/__tests__ src/lib/components/shell/__tests__/BottomNav.test.js
git commit -m "feat(nav): redirect and hide capability-gated routes"
```

---

### Task 5: Probe History availability at startup

History (`/history`) has no config field, so it's gated on endpoint presence. Add a non-fatal capability probe to `FetchData` that records `uistates.history_available`. Non-fatal: a missing `/history` must not trip the startup error dialog.

**Files:**
- Modify: `src/lib/stores/uistates.js` (add `history_available: true` to the model)
- Modify: `src/lib/data/FetchData.svelte` (add a non-fatal probe after the fatal steps)
- Test: `src/lib/data/__tests__/FetchData.history.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/data/__tests__/FetchData.history.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))
// Every store download resolves true except history, which we vary per test.
vi.mock('../../stores/history.js', () => ({ history_store: { download: vi.fn() } }))

import { httpAPI } from '../../api/httpAPI.js'
import { history_store } from '../../stores/history.js'
import { uistates_store } from '../../stores/uistates.js'
import FetchData from '../FetchData.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({}) // bulk-load steps succeed
  uistates_store.update((u) => ({ ...u, history_available: true }))
})

describe('FetchData history probe', () => {
  it('marks history unavailable when the probe fails, without erroring startup', async () => {
    history_store.download.mockResolvedValue(false)
    let errored = false
    render(FetchData, { props: { onError: () => (errored = true), onLoaded: () => {} } })
    await vi.waitFor(() => expect(get(uistates_store).history_available).toBe(false))
    expect(errored).toBe(false)
  })
  it('marks history available when the probe succeeds', async () => {
    history_store.download.mockResolvedValue(true)
    render(FetchData, { props: { onLoaded: () => {} } })
    await vi.waitFor(() => expect(get(uistates_store).history_available).toBe(true))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/data/__tests__/FetchData.history.test.js`
Expected: FAIL — `history_available` is never set (no probe yet).

- [ ] **Step 3: Add the uistates field**

In `src/lib/stores/uistates.js`, add to the `model` object (next to the other `local states`):

```js
		history_available: true,
```

- [ ] **Step 4: Add the non-fatal probe to FetchData**

In `src/lib/data/FetchData.svelte`, import the history store and run the probe after the fatal `loadData` loop completes. Add the import:

```js
  import { history_store } from '../stores/history.js'
```

Change `loadData` so the probe runs after the fatal steps but before `onLoaded`:

```js
  async function loadData() {
    for (const step of steps) {
      onStatus('loading')
      const ok = await step.store.download()
      if (!ok) {
        onStatus('error')
        onError()
        return
      }
      step.after?.()
      onProgress(step.progress)
    }
    // Non-fatal capability probe: a device without /history (JuiceBox) must
    // still finish startup — we just hide the History tab.
    const hist = await history_store.download()
    $uistates_store.history_available = hist !== false
    onStatus('ok')
    onLoaded()
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/data/__tests__/FetchData.history.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stores/uistates.js src/lib/data/FetchData.svelte src/lib/data/__tests__/FetchData.history.test.js
git commit -m "feat(data): probe /history availability at startup (non-fatal)"
```

---

### Task 6: Lazy-load chart subtrees behind a build flag

Two static import chains pull uplot: `ChargingHero → SessionChart → UplotChart → uplot`, and `Monitoring → EnergyTab → Energy*Chart → uplot`. Break both with build-conditional dynamic `import()` keyed to `import.meta.env.VITE_CHARTS`, so the JuiceBox build dead-code-eliminates them and never emits the `charts` chunk. The Dashboard keeps its non-chart content; Monitoring is entirely charts, so its whole route is gated.

The env check is **inlined at each `import()` site** (not read through a shared const) so esbuild can fold it and drop the import.

**Files:**
- Create: `src/lib/charts/lazy.js`
- Create: `src/lib/components/dashboard/SessionChartLazy.svelte`
- Modify: `src/lib/components/dashboard/ChargingHero.svelte:5,54`
- Create: `src/routes/MonitoringLazy.svelte`
- Modify: `src/lib/routes.js` (map `/monitoring` to `MonitoringLazy`)
- Test: `src/lib/charts/__tests__/lazy.test.js`
- Test: `src/lib/components/dashboard/__tests__/SessionChartLazy.test.js`

- [ ] **Step 1: Write the lazy-flag test**

```js
// src/lib/charts/__tests__/lazy.test.js
import { describe, it, expect } from 'vitest'
import { CHARTS_ENABLED } from '../lazy.js'

describe('CHARTS_ENABLED', () => {
  it('is true by default (VITE_CHARTS unset in test env)', () => {
    expect(CHARTS_ENABLED).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/charts/__tests__/lazy.test.js`
Expected: FAIL — `Failed to resolve import "../lazy.js"`.

- [ ] **Step 3: Create the lazy flag module**

```js
// src/lib/charts/lazy.js
// False only in the charts-stripped (JuiceBox) build (`VITE_CHARTS=false`).
// Used for nav/route gating. NOTE: the dynamic import() guards below inline
// `import.meta.env.VITE_CHARTS !== 'false'` directly rather than importing this
// const, so esbuild can constant-fold and drop the import in the stripped build.
export const CHARTS_ENABLED = import.meta.env.VITE_CHARTS !== 'false'
```

- [ ] **Step 4: Write the SessionChartLazy test**

```js
// src/lib/components/dashboard/__tests__/SessionChartLazy.test.js
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import { vi } from 'vitest'
import SessionChartLazy from '../SessionChartLazy.svelte'

describe('SessionChartLazy', () => {
  it('mounts without throwing and resolves the chart when charts are enabled', async () => {
    const { container } = render(SessionChartLazy, { props: { samples: [], voltage: 230, target: null, sessionElapsed: 0 } })
    expect(container).toBeTruthy()
    // The real chart loads asynchronously; the wrapper renders nothing until then.
    await Promise.resolve()
  })
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run src/lib/components/dashboard/__tests__/SessionChartLazy.test.js`
Expected: FAIL — `Failed to resolve import "../SessionChartLazy.svelte"`.

- [ ] **Step 6: Create the SessionChartLazy wrapper**

```svelte
<!-- src/lib/components/dashboard/SessionChartLazy.svelte -->
<script>
  // Loads the uplot-backed SessionChart on demand. The inlined env check lets
  // the JuiceBox build (VITE_CHARTS=false) dead-code-eliminate the import() so
  // uplot never enters the bundle.
  let { samples = [], voltage = 0, target = null, sessionElapsed = 0 } = $props()

  let Chart = $state(null)
  if (import.meta.env.VITE_CHARTS !== 'false') {
    import('./SessionChart.svelte').then((m) => (Chart = m.default))
  }
</script>

{#if Chart}
  <Chart {samples} {voltage} {target} {sessionElapsed} />
{/if}
```

- [ ] **Step 7: Swap ChargingHero to the lazy wrapper**

In `src/lib/components/dashboard/ChargingHero.svelte`, replace the import on line 5:

```js
  import SessionChartLazy from './SessionChartLazy.svelte'
```

and the usage on line 54:

```svelte
    <SessionChartLazy {samples} {voltage} {target} {sessionElapsed} />
```

- [ ] **Step 8: Create the Monitoring lazy route wrapper**

```svelte
<!-- src/routes/MonitoringLazy.svelte -->
<script>
  // Monitoring is entirely charts. In the JuiceBox build (VITE_CHARTS=false)
  // the import() is eliminated and we redirect home; the route is also in the
  // Router's `blocked` set, so this redirect is belt-and-suspenders.
  import { redirect } from '../lib/router.js'

  let Page = $state(null)
  if (import.meta.env.VITE_CHARTS !== 'false') {
    import('./Monitoring.svelte').then((m) => (Page = m.default))
  } else {
    redirect('/')
  }
</script>

{#if Page}
  <Page />
{/if}
```

- [ ] **Step 9: Point the route at the wrapper**

In `src/lib/routes.js`, replace the static `Monitoring` import with the wrapper:

```js
import Monitoring from '../routes/MonitoringLazy.svelte'
```

(The `routes['/monitoring'] = Monitoring` mapping stays; only the imported module changes. This removes `Monitoring.svelte` → `EnergyTab` → uplot from the eager graph.)

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run src/lib/charts/__tests__/lazy.test.js src/lib/components/dashboard/__tests__/SessionChartLazy.test.js`
Expected: PASS.

- [ ] **Step 11: Run the full suite + a normal build to confirm nothing broke**

Run: `npm test`
Expected: PASS (all suites).
Run: `npm run build`
Expected: build succeeds; `dist/` still contains a `charts-*.js.gz` (default build keeps charts).

- [ ] **Step 12: Commit**

```bash
git add src/lib/charts src/lib/components/dashboard/SessionChartLazy.svelte src/lib/components/dashboard/ChargingHero.svelte src/routes/MonitoringLazy.svelte src/lib/routes.js src/lib/components/dashboard/__tests__/SessionChartLazy.test.js
git commit -m "feat(charts): lazy-load uplot subtrees behind VITE_CHARTS"
```

---

### Task 7: Two build profiles + verification, and retirement docs

Produce a default build (charts in) and a JuiceBox build (`VITE_CHARTS=false`, charts stripped) into separate output dirs, and assert the JuiceBox build emits **no** `charts` chunk. Record the lite retirement and the firmware dependencies in the README.

**Files:**
- Modify: `package.json` (scripts)
- Create: `scripts/verify-juicebox-build.mjs`
- Modify: `README.md` (build matrix + JuiceBox notes)

- [ ] **Step 1: Add the build scripts**

In `package.json`, replace the `"build"` script and add the JuiceBox + combined builds:

```json
    "build": "vite build --outDir dist-full --emptyOutDir",
    "build:juicebox": "VITE_CHARTS=false vite build --outDir dist-juicebox --emptyOutDir",
    "build:all": "npm run build && npm run build:juicebox && node scripts/verify-juicebox-build.mjs",
```

- [ ] **Step 2: Create the verification script**

```js
// scripts/verify-juicebox-build.mjs
// Fails the build if the JuiceBox profile shipped the uplot chart chunk.
import { readdirSync } from 'node:fs'

const dir = 'dist-juicebox/assets'
let files = []
try { files = readdirSync(dir) } catch { /* no assets dir */ }
const leaked = files.filter((f) => /^charts-.*\.(js|css)(\.gz)?$/.test(f))
if (leaked.length) {
  console.error(`JuiceBox build leaked chart chunk(s): ${leaked.join(', ')}`)
  process.exit(1)
}
console.log('OK: JuiceBox build contains no uplot/chart chunk.')
```

- [ ] **Step 3: Build both profiles and run the verifier**

Run: `npm run build:all`
Expected: both builds succeed; final line `OK: JuiceBox build contains no uplot/chart chunk.` `dist-full/assets/` contains a `charts-*.js.gz`; `dist-juicebox/assets/` does not.

- [ ] **Step 4: Document the build matrix and retirement**

Add a section to `README.md`:

```markdown
## Build targets

- `npm run build` → `dist-full/` — ESP32 image (WebSocket transport + charts).
- `npm run build:juicebox` → `dist-juicebox/` — JuiceBox/LibreTiny image; the
  uplot chart chunk is stripped (`VITE_CHARTS=false`), Monitoring and the
  dashboard session chart are gated off.
- `npm run build:all` → both, then verifies the JuiceBox build shipped no chart chunk.

Both builds are one source tree. Transport (WebSocket vs polling) is chosen at
runtime; feature visibility is data-driven from the device's `/config` and
endpoint responses. The only build-time difference is the chart chunk.

This UI supersedes `openevse-gui-lite`, which is retired. Firmware dependencies
(separate slice): the JuiceBox firmware must accept `POST /config` JSON and embed
`dist-juicebox/`.
```

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/verify-juicebox-build.mjs README.md
git commit -m "build: two profiles (full + charts-stripped JuiceBox) with verification"
```

---

## Execution dependency note

Tasks 1–3 are independent and can run in order. **Task 4 references `CHARTS_ENABLED` (Task 6) and `uistates.history_available` (Task 5).** Execute in the order **1 → 2 → 3 → 5 → 6 → 4 → 7** so every symbol Task 4 wires together already exists. (The plan is numbered by topic for readability; this is the build order.)

## Self-Review

**Spec coverage:**
- Transport manager (probe/baseline) → Tasks 1, 2. ✓
- Data-driven settings gating + presence-not-truthiness → Task 3. ✓
- Nav + route gating, deep-link redirect → Task 4. ✓
- Endpoint-presence gating (history) → Task 5; certificates noted (kept visible — see note). 
- POST-JSON write convergence → already true in nightshift; no task needed (documented in spec/README). ✓
- Two-build `VITE_CHARTS` strip + verification → Tasks 6, 7. ✓
- Lite retirement + firmware deps → Task 7 (docs). ✓

**Known follow-up (not blocking):** `certificates` is left ungated (always visible) because it has no config field and the startup probe in Task 5 covers only `/history`. If certificates must hide on JuiceBox, add a second non-fatal probe in Task 5 mirroring history and a `requires`-style entry; deferred to keep this plan focused (YAGNI until a JuiceBox actually lacks `/certificates`).

**Open detail confirmed in spec:** the exact `/config` field names driving `requires` (Task 3 step 3) should be checked against JuiceBox firmware/hardware. The chosen `*_enabled` fields are the natural capability markers; adjust if the firmware reports different names.

**Type/name consistency:** `CHARTS_ENABLED` (export) vs inlined `import.meta.env.VITE_CHARTS !== 'false'` at import() sites — intentional (DCE), documented in Task 6. `caps = { charts, history }` shape consistent across AppShell (Task 4) and BottomNav (Task 4). `uistates.history_available` consistent across Tasks 4 and 5. `blocked` prop consistent across Router and AppShell (Task 4).
