# Write-Feedback Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Dashboard's Eco/Shaper toggles to the device, and make failed device writes visible (global `AlertBox`) and non-optimistic (controls reflect only confirmed state).

**Architecture:** A shared `showWriteError()` helper in `src/lib/alerts.js` surfaces the global alert. `override_store.upload` becomes pessimistic (update-on-success, boolean return) so override-backed controls cannot show unconfirmed state. `Dashboard.svelte` wires Eco/Shaper handlers, checks every write result, and remounts the charge-rate slider on a failed write so it reverts. `Schedule.svelte` switches to the shared helper.

**Tech Stack:** Svelte 5 (runes), Tailwind 4, `svelte-i18n`, Vitest + `@testing-library/svelte`.

**Preconditions:**
- The v3 foundation + all four screens are merged to `main`. Work happens on a `write-feedback` branch (the executor creates it).
- 325 tests pass. `httpAPI` (`src/lib/api/httpAPI.js`) returns the string `"error"` on a failed request. `uistates_store` (`src/lib/stores/uistates.js`) has `setObject(key, value)` and `resetAlertBox()`; `App.svelte` renders the global `AlertBox` from `uistates_store.alertbox`.

**Plan-level decisions:**
- The failure convention is `httpAPI` → `"error"` (or a `msg: "error"` body) — the same one `download`, `clear`, `schedule_store`, and `limit_store` already use.
- One generic alert message for every screen.
- Only the charge-rate slider gets an explicit revert; every other control is store-derived and already pessimistic.

---

## File Structure

```
src/lib/i18n/en.json                 (modify — add the "alert" block)
src/lib/alerts.js                     NEW — showWriteError() shared helper
src/lib/stores/override.js            (modify — upload: pessimistic + boolean return)
src/routes/Dashboard.svelte           (modify — wire Eco/Shaper, check writes, slider revert)
src/routes/Schedule.svelte            (modify — use the shared showWriteError helper)
```

---

## Task 1: Alert i18n keys

**Files:**
- Modify: `src/lib/i18n/en.json`
- Test: `src/lib/i18n/__tests__/alert-i18n.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/i18n/__tests__/alert-i18n.test.js`

```js
import { describe, it, expect } from 'vitest'
import en from '../en.json'

describe('alert i18n keys', () => {
  it('has the alert block', () => {
    expect(en.alert.write_failed_title).toBeTypeOf('string')
    expect(en.alert.write_failed_body).toBeTypeOf('string')
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- alert-i18n`.

- [ ] **Step 3: Add the `"alert"` block to `src/lib/i18n/en.json`** as a new top-level key (keep all existing keys; valid JSON):

```json
  "alert": {
    "write_failed_title": "Change not saved",
    "write_failed_body": "The charger didn't accept the change. Please try again."
  }
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- alert-i18n`. Then full suite `npm test` — all green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add write-error alert i18n keys\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

## Task 2: showWriteError shared helper

**Files:**
- Create: `src/lib/alerts.js`
- Test: `src/lib/__tests__/alerts.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/__tests__/alerts.test.js`

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import { uistates_store } from '../stores/uistates.js'
import { showWriteError } from '../alerts.js'

describe('showWriteError', () => {
  beforeEach(() => {
    uistates_store.resetAlertBox()
  })

  it('makes the global alert visible with the write-error message', () => {
    showWriteError()
    const alert = get(uistates_store).alertbox
    expect(alert.visible).toBe(true)
    expect(alert.title).toBe('alert.write_failed_title')
    expect(alert.body).toBe('alert.write_failed_body')
  })

  it('gives the alert a reset action that clears it', () => {
    showWriteError()
    const alert = get(uistates_store).alertbox
    expect(alert.action).toBeTypeOf('function')
    alert.action()
    expect(get(uistates_store).alertbox.visible).toBe(false)
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- __tests__/alerts` — module missing.

- [ ] **Step 3: Create `src/lib/alerts.js`**

```js
import { get } from 'svelte/store'
import { _ } from 'svelte-i18n'
import { uistates_store } from './stores/uistates.js'

/**
 * Surface the global AlertBox for a failed device write.
 * Shared by every screen so the write-failure experience is identical.
 */
export function showWriteError() {
  const t = get(_)
  uistates_store.setObject('alertbox', {
    title: t('alert.write_failed_title'),
    body: t('alert.write_failed_body'),
    visible: true,
    button: true,
    closable: true,
    component: undefined,
    action: () => uistates_store.resetAlertBox(),
  })
}
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- __tests__/alerts`. Then full suite `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add showWriteError shared alert helper\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

## Task 3: Make override_store.upload pessimistic

**Files:**
- Modify: `src/lib/stores/override.js`
- Modify (test): `src/lib/stores/__tests__/override.test.js`

- [ ] **Step 1: Add failing tests** — append these two tests inside the `describe('override_store', …)` block in `src/lib/stores/__tests__/override.test.js` (after the existing `should upload override data` test):

```js
  it('returns false and leaves the store unchanged when the upload request fails', async () => {
    override_store.set({ state: 'active', charge_current: 10 })
    httpAPI.mockResolvedValue('error')

    const result = await override_store.upload({ state: 'disabled', charge_current: 32 })
    expect(result).toBe(false)
    expect(get(override_store).charge_current).toBe(10)
  })

  it('returns true on a successful upload', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const result = await override_store.upload({ charge_current: 20 })
    expect(result).toBe(true)
  })
```

- [ ] **Step 2: Run the test file, verify the new tests FAIL** — `npm test -- stores/__tests__/override` — the current `upload` always updates the store and returns the store object (truthy, not `false`/`true`).

- [ ] **Step 3: Replace the `upload` function in `src/lib/stores/override.js`.** Find the current function:

```js
    async function upload(data) {
        // let override = get(P)
		// let newoverridestore = {...override, ...data}
        let res = await httpAPI("POST", "/override", JSON.stringify(data))
        P.update(() => data)
        return P
    }
```

Replace it with:

```js
    async function upload(data) {
        let res = await httpAPI("POST", "/override", JSON.stringify(data))
        // Update the store only on a confirmed success — never show an
        // override the device did not accept. httpAPI yields "error" on a
        // failed request; a msg:"error" body is also a failure.
        if (res && res !== "error" && res?.msg !== "error") {
            P.update(() => data)
            return true
        }
        return false
    }
```

- [ ] **Step 4: Run tests, verify they PASS** — `npm test -- stores/__tests__/override`. The existing `should upload override data` test (mocks `{ msg: 'done' }`) still passes — that is a success response, so the store still updates. Then full suite `npm test` — all green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Make override_store.upload pessimistic with a boolean result\n\nupload now updates the store only on a confirmed device success and\nreturns a boolean, so override-backed controls never show an\nunconfirmed state.\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

## Task 4: Wire Dashboard Eco/Shaper, write checks, and slider revert

**Files:**
- Replace: `src/routes/Dashboard.svelte`
- Modify (test): `src/routes/__tests__/Dashboard.test.js`

- [ ] **Step 1: Add failing tests** — replace the whole header of `src/routes/__tests__/Dashboard.test.js` (imports + `beforeEach`) and append two new tests. The full new file:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({})) }))

import { httpAPI } from '../../lib/api/httpAPI.js'
import { status_store } from '../../lib/stores/status.js'
import { config_store } from '../../lib/stores/config.js'
import { claims_target_store } from '../../lib/stores/claims_target.js'
import { override_store } from '../../lib/stores/override.js'
import { uistates_store } from '../../lib/stores/uistates.js'
import { EvseClients } from '../../lib/vars.js'
import Dashboard from '../Dashboard.svelte'

describe('Dashboard', () => {
  beforeEach(() => {
    config_store.set({ max_current_soft: 48, divert_enabled: false, current_shaper_enabled: false })
    claims_target_store.set({ properties: {}, claims: { state: null } })
    override_store.set(undefined)
    uistates_store.resetAlertBox()
    httpAPI.mockReset()
    httpAPI.mockResolvedValue({})
  })

  it('renders the charging composition when state is 3', () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 32000, session_energy: 12300, session_elapsed: 6129, temp: 427, pilot: 32, max_current: 48 })
    const { getByText } = render(Dashboard)
    expect(getByText('dashboard.status.charging')).toBeInTheDocument()
  })

  it('renders the idle composition when state is 1', () => {
    status_store.set({ state: 1, total_day: 3.2, total_energy: 7523 })
    const { getByText } = render(Dashboard)
    expect(getByText('dashboard.ring.ready')).toBeInTheDocument()
  })

  it('disables mode segments when RFID client owns the state claim', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    claims_target_store.set({ properties: {}, claims: { state: EvseClients.rfid.id } })
    const { getAllByRole } = render(Dashboard)
    const buttons = getAllByRole('button')
    const modeButtons = buttons.filter((btn) => btn.hasAttribute('aria-pressed'))
    expect(modeButtons.length).toBeGreaterThan(0)
    modeButtons.forEach((btn) => {
      expect(btn).toBeDisabled()
    })
  })

  it('surfaces the global alert when a mode write fails', async () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    httpAPI.mockResolvedValue('error')
    const { getByText } = render(Dashboard)
    await fireEvent.click(getByText('dashboard.mode.on'))
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })

  it('drives /divertmode when the Eco toggle is switched on', async () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    config_store.set({ max_current_soft: 48, divert_enabled: true, current_shaper_enabled: false })
    const { getByLabelText } = render(Dashboard)
    await fireEvent.click(getByLabelText('dashboard.eco'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/divertmode', 'divertmode=2', 'text')
    })
  })
})
```

- [ ] **Step 2: Run test, verify the two new tests FAIL** — `npm test -- routes/__tests__/Dashboard` — the current Dashboard has no-op Eco/Shaper stubs and does not surface the alert.

- [ ] **Step 3: Replace `src/routes/Dashboard.svelte`** with exactly:

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import { status_store } from '../lib/stores/status.js'
  import { config_store } from '../lib/stores/config.js'
  import { override_store } from '../lib/stores/override.js'
  import { limit_store } from '../lib/stores/limit.js'
  import { claims_target_store } from '../lib/stores/claims_target.js'
  import { plan_store } from '../lib/stores/plan.js'
  import { uistates_store } from '../lib/stores/uistates.js'
  import { httpAPI } from '../lib/api/httpAPI.js'
  import { serialQueue } from '../lib/queue.js'
  import { EvseClients } from '../lib/vars.js'
  import { sec2time, temp_round, round, clientid2name, getStateDesc } from '../lib/utils.js'
  import { showWriteError } from '../lib/alerts.js'
  import { displayState, ringFill, connectedReason } from '../lib/dashboard/state.js'

  import StatusLine from '../lib/components/dashboard/StatusLine.svelte'
  import PowerRing from '../lib/components/dashboard/PowerRing.svelte'
  import StatChips from '../lib/components/dashboard/StatChips.svelte'
  import ModeSelector from '../lib/components/dashboard/ModeSelector.svelte'
  import ChargeRate from '../lib/components/dashboard/ChargeRate.svelte'
  import ChargeLimitCard from '../lib/components/dashboard/ChargeLimitCard.svelte'
  import ChargeLimitModal from '../lib/components/dashboard/ChargeLimitModal.svelte'
  import EcoShaperToggles from '../lib/components/dashboard/EcoShaperToggles.svelte'

  let limitModalOpen = $state(false)
  let busy = $state(false)
  let rateNonce = $state(0)

  // ── derived view-model ──────────────────────────────────────────────────
  let display = $derived(displayState($status_store))
  let charging = $derived(display === 'charging')
  let mode = $derived($uistates_store?.mode ?? 0)
  let maxAmps = $derived($config_store?.max_current_soft ?? 48)
  let fill = $derived(ringFill($status_store, $config_store, $limit_store))
  let reason = $derived(connectedReason(mode, $plan_store))

  let kw = $derived((($status_store?.power ?? 0) / 1000).toFixed(1))
  let maxKw = $derived((maxAmps * ($status_store?.voltage ?? 0) / 1000).toFixed(1))

  let live = $derived({
    sessionKwh: (($status_store?.session_energy ?? 0) / 1000).toFixed(2),
    elapsed: sec2time($status_store?.session_elapsed ?? 0),
    currentA: (($status_store?.amp ?? 0) / 1000).toFixed(1),
    voltage: $status_store?.voltage ?? 0,
    tempC: temp_round($status_store?.temp),
    pilotA: $status_store?.pilot ?? 0,
  })
  let summary = $derived({
    todayKwh: round($status_store?.total_day ?? 0, 1),
    totalKwh: round($status_store?.total_energy ?? 0, 0),
  })

  let chargeAmps = $derived(
    $claims_target_store?.properties?.charge_current
      ? Math.min($claims_target_store.properties.charge_current, maxAmps)
      : maxAmps,
  )
  let rateClaimedBy = $derived(
    $claims_target_store?.claims?.charge_current &&
    $claims_target_store.claims.charge_current !== EvseClients.manual.id
      ? clientid2name($claims_target_store.claims.charge_current)
      : '',
  )

  let claimOwner = $derived($claims_target_store?.claims?.state)
  let modeLocked = $derived(
    claimOwner === EvseClients.ocpp.id ||
    claimOwner === EvseClients.limit.id ||
    claimOwner === EvseClients.rfid.id,
  )

  let showEco = $derived(!!$config_store?.divert_enabled)
  let showShaper = $derived(!!$config_store?.current_shaper_enabled)
  let ecoOn = $derived($status_store?.divertmode === 2 && mode === 0)
  let shaperOn = $derived(!!$uistates_store?.shaper)

  let limitSummary = $derived(formatLimit($limit_store))
  function formatLimit(l) {
    if (!l || !l.type || l.type === 'none') return ''
    if (l.type === 'time') return sec2time(l.value * 60)
    if (l.type === 'energy') return `${round(l.value / 1000, 1)} kWh`
    if (l.type === 'soc') return `${l.value}%`
    if (l.type === 'range') return `${l.value} km`
    return ''
  }

  // ── actions (all writes serialized) ─────────────────────────────────────
  async function setMode(m) {
    if (busy) return
    busy = true
    try {
      let ok
      if (m === 0) {
        ok = await serialQueue.add(() => override_store.clear())
      } else {
        const data = { state: m === 1 ? 'active' : 'disabled' }
        const cur = override_store.get(override_store)?.charge_current
        data.charge_current = cur ?? $config_store?.max_current_soft
        ok = await serialQueue.add(() => override_store.upload(data))
      }
      if (!ok) showWriteError()
    } finally {
      busy = false
    }
  }

  async function setChargeAmps(val) {
    if (busy) return
    busy = true
    try {
      if (val >= maxAmps) {
        await serialQueue.add(() => override_store.removeProp('charge_current'))
      } else {
        const current = override_store.get(override_store) ?? {}
        const ok = await serialQueue.add(() => override_store.upload({ ...current, charge_current: val }))
        if (!ok) {
          showWriteError()
          rateNonce++ // remount ChargeRate so the slider reverts to the confirmed value
        }
      }
    } finally {
      busy = false
    }
  }

  async function setEco(on) {
    if (busy) return
    busy = true
    try {
      const res = await serialQueue.add(() =>
        httpAPI('POST', '/divertmode', `divertmode=${on ? 2 : 1}`, 'text'),
      )
      if (res === 'error') showWriteError()
    } finally {
      busy = false
    }
  }

  async function setShaper(on) {
    if (busy) return
    busy = true
    try {
      const res = await serialQueue.add(() =>
        httpAPI('POST', '/shaper', `shaper=${on ? 1 : 0}`, 'text'),
      )
      if (res === 'error') showWriteError()
    } finally {
      busy = false
    }
  }

  async function saveLimit(limit) {
    limitModalOpen = false
    const ok = await serialQueue.add(() => limit_store.upload(limit))
    if (ok) {
      await serialQueue.add(() => limit_store.download())
    } else {
      showWriteError()
    }
  }

  async function clearLimit() {
    const ok = await serialQueue.add(() => limit_store.remove())
    if (!ok) showWriteError()
  }
</script>

<section class="px-4 pb-4">
  <StatusLine {display} />

  <PowerRing
    {display}
    {fill}
    {kw}
    maxKw={charging ? maxKw : ''}
    reasonKey={reason.key}
    reasonValues={reason.values}
    faultText={getStateDesc($status_store?.state) ?? ''}
  />

  <StatChips {charging} {live} {summary} />

  {#if display !== 'error'}
    <EcoShaperToggles
      {showEco} {ecoOn} onEco={setEco}
      {showShaper} {shaperOn} onShaper={setShaper}
      disabled={busy}
    />

    <ModeSelector {mode} disabled={busy || modeLocked} onmode={setMode} />

    {#key rateNonce}
      <ChargeRate
        amps={chargeAmps}
        min={6}
        max={maxAmps}
        disabled={busy || ecoOn}
        claimedBy={rateClaimedBy}
        onchange={setChargeAmps}
      />
    {/key}

    <ChargeLimitCard
      limit={$limit_store}
      summary={limitSummary}
      onopen={() => (limitModalOpen = true)}
      onclear={clearLimit}
    />
  {/if}
</section>

<ChargeLimitModal
  open={limitModalOpen}
  allowSoc={$status_store?.battery_level !== undefined}
  allowRange={$status_store?.battery_range !== undefined}
  onclose={() => (limitModalOpen = false)}
  onsave={saveLimit}
/>
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- routes/__tests__/Dashboard`. Then full suite `npm test` — all green. If a test fails, fix the implementation (not the test) until green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Wire Dashboard Eco/Shaper handlers and failed-write feedback\n\nEco/Shaper toggles drive /divertmode and /shaper. Every write path\nchecks its result and surfaces the global AlertBox on failure; the\ncharge-rate slider remounts to revert on a failed write.\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

## Task 5: Schedule route uses the shared helper

**Files:**
- Modify: `src/routes/Schedule.svelte`

- [ ] **Step 1: Update `src/routes/Schedule.svelte`.** Add the import (alongside the existing imports):

```js
  import { showWriteError } from '../lib/alerts.js'
```

Remove the local `alertFail` function entirely:

```js
  function alertFail() {
    uistates_store.setObject('alertbox', {
      title: $_('schedule.error_title'),
      body: $_('schedule.error_body'),
      visible: true,
      button: true,
      closable: true,
      component: undefined,
      action: () => uistates_store.resetAlertBox(),
    })
  }
```

Replace both `alertFail()` call sites (in `save` and `remove`) with `showWriteError()`.

The `uistates_store` import becomes unused after `alertFail` is removed — remove the
`import { uistates_store } from '../lib/stores/uistates.js'` line as well.

- [ ] **Step 2: Run the Schedule tests** — `npm test -- routes/__tests__/Schedule`. The existing `surfaces the global AlertBox when a save fails` test asserts `get(uistates_store).alertbox.visible` is `true` after a failed save — `showWriteError()` sets exactly that, so it still passes. (It also asserts the title equals `schedule.error_title`; update that test's last line to the shared key.)

  In `src/routes/__tests__/Schedule.test.js`, find:
```js
    expect(get(uistates_store).alertbox.title).toBe('schedule.error_title')
```
  and replace it with:
```js
    expect(get(uistates_store).alertbox.title).toBe('alert.write_failed_title')
```

- [ ] **Step 3: Run tests** — `npm test -- routes/__tests__/Schedule`, then full suite `npm test` — all green.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(printf 'Switch the Schedule route to the shared write-error helper\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

## Task 6: Verification

**Files:** none (verification only).

- [ ] **Step 1: Full suite** — `npm test`. Expected: all tests pass (325 prior + the new ones).

- [ ] **Step 2: Production build** — `npm run build`. Expected: succeeds; gzipped assets in `dist/assets/` (no plain `.js`/`.css` except `sw.js`).

- [ ] **Step 3: Report** the final test count and build result.

---

## Self-Review

**Spec coverage:**
- Eco/Shaper handlers wired to `/divertmode` and `/shaper` — Task 4. ✓
- Shared `showWriteError()` helper — Task 2. ✓
- `override_store.upload` made pessimistic + boolean — Task 3. ✓
- Every Dashboard write path checks its result and alerts on failure — Task 4. ✓
- Charge-rate slider reverts on a failed write (`{#key rateNonce}`) — Task 4. ✓
- Schedule route uses the one shared pattern — Task 5. ✓
- `alert.*` i18n — Task 1. ✓
- Testing: helper unit-tested; `override_store.upload` failure path tested; Dashboard
  failed-mode-write + Eco-endpoint tested; Schedule's failed-write test kept green. ✓

**Placeholder scan:** No TBD/TODO. Every step has complete code or a precise edit.

**Type consistency:** `showWriteError` is a no-arg function, imported and called the
same way in `Dashboard.svelte` and `Schedule.svelte`. `override_store.upload` now
returns a boolean; all call sites (`setMode`, `setChargeAmps` via direct call,
`removeProp` internally) treat the result as truthy/falsy — consistent. `httpAPI`'s
`text`-type POST returns `"error"` on failure — `setEco`/`setShaper` check exactly
that. The `rateNonce` `$state` is bumped only in `setChargeAmps` and consumed only by
the `{#key}` block.
