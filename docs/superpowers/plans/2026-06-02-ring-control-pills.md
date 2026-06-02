# Ring Control Pills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Dashboard's Charge-mode row and Charge-rate row with two compact pills that flank the power ring (mode top-left, rate top-right), each opening a popover to change the value.

**Architecture:** A generic `ui/Popover.svelte` (anchored panel, click-outside + Escape) backs two new presentational components, `dashboard/ModePill.svelte` and `dashboard/RatePill.svelte`. `Dashboard.svelte` positions them around `PowerRing` and feeds them the existing mode/rate wiring; the old `ModeSelector`/`ChargeRate` components are deleted.

**Tech Stack:** Svelte 5 (runes), Tailwind 4 (`surface-2`, `accent`, `text`/`text-dim`, `border`), Vitest + @testing-library/svelte, svelte-i18n.

**Design spec:** `docs/superpowers/specs/2026-06-02-ring-control-pills-design.md`

**Conventions (read once):**
- Tests live in `__tests__/` next to the code. Component tests mock svelte-i18n so `$_('a.b.c')` returns the literal key `'a.b.c'` (see `ChargeRate.test.js`).
- Run one file: `npx vitest run <path>`. Full suite: `npm test`. Build: `npm run build`.
- Commit per task; end every message with:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- Svelte 5 runes only (`$props`, `$state`, `$derived`). Snippets via `{@render ...}`.

---

### Task 1: Generic `Popover.svelte`

**Files:**
- Create: `src/lib/components/ui/Popover.svelte`
- Test: `src/lib/components/ui/__tests__/Popover.test.js`

**Context:** A floating panel anchored to a positioned parent (the pill provides `class="relative"` + the trigger button). Popover renders only the backdrop + panel; the caller owns the trigger. Closes on backdrop click and Escape. Panel content comes in via the `children` snippet.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/ui/__tests__/Popover.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'

import Popover from '../Popover.svelte'

const panel = createRawSnippet(() => ({
  render: () => `<div data-testid="panel">panel</div>`,
}))

describe('Popover', () => {
  it('renders the panel only when open', () => {
    const closed = render(Popover, { props: { open: false, children: panel } })
    expect(closed.queryByTestId('panel')).not.toBeInTheDocument()
    closed.unmount()
    const opened = render(Popover, { props: { open: true, children: panel } })
    expect(opened.getByTestId('panel')).toBeInTheDocument()
  })

  it('calls onclose when the backdrop is clicked', async () => {
    const onclose = vi.fn()
    const { getByRole } = render(Popover, { props: { open: true, onclose, children: panel } })
    await fireEvent.click(getByRole('presentation'))
    expect(onclose).toHaveBeenCalledOnce()
  })

  it('calls onclose on Escape', async () => {
    const onclose = vi.fn()
    render(Popover, { props: { open: true, onclose, children: panel } })
    await fireEvent.keyDown(window, { key: 'Escape' })
    expect(onclose).toHaveBeenCalledOnce()
  })

  it('right-aligns the panel when align is right', () => {
    const { getByRole } = render(Popover, { props: { open: true, align: 'right', children: panel } })
    expect(getByRole('menu').className).toContain('right-0')
  })

  it('left-aligns by default', () => {
    const { getByRole } = render(Popover, { props: { open: true, children: panel } })
    expect(getByRole('menu').className).toContain('left-0')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/components/ui/__tests__/Popover.test.js`
Expected: FAIL — cannot resolve `../Popover.svelte`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/components/ui/Popover.svelte`:

```svelte
<script>
  let { open = false, align = 'left', onclose = () => {}, children } = $props()

  function onKey(e) {
    if (open && e.key === 'Escape') onclose()
  }
</script>

<svelte:window onkeydown={onKey} />

{#if open}
  <!-- full-viewport transparent catcher for click-outside (mirrors Modal.svelte) -->
  <div class="fixed inset-0 z-40" role="presentation" onclick={onclose}></div>
  <div
    class="absolute top-full z-50 mt-1 {align === 'right' ? 'right-0' : 'left-0'}"
    role="menu"
  >
    {@render children?.()}
  </div>
{/if}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/components/ui/__tests__/Popover.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ui/Popover.svelte src/lib/components/ui/__tests__/Popover.test.js
git commit -m "feat(ui): generic Popover (anchored panel, click-outside + Escape)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `ModePill.svelte`

**Files:**
- Create: `src/lib/components/dashboard/ModePill.svelte`
- Test: `src/lib/components/dashboard/__tests__/ModePill.test.js`

**Context:** Presentational. Shows the current mode (Auto/On/Off) as a pill; tap opens a `Popover` listing the three modes. When `locked`, it's dimmed, non-interactive, and shows the short owner word (`lockLabel`, e.g. `RFID`) instead of the mode. The pill button's accessible name is `dashboard.mode.aria`. The value label and the `▾` are separate spans so tests can match the label text exactly.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/dashboard/__tests__/ModePill.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ModePill from '../ModePill.svelte'

describe('ModePill', () => {
  it('shows the current mode label', () => {
    const { getByText } = render(ModePill, { props: { mode: 0 } })
    expect(getByText('dashboard.mode.auto')).toBeInTheDocument()
  })

  it('opens the popover and emits onmode for the chosen mode', async () => {
    const onmode = vi.fn()
    const { getByRole, getByText } = render(ModePill, { props: { mode: 0, onmode } })
    await fireEvent.click(getByRole('button', { name: 'dashboard.mode.aria' }))
    await fireEvent.click(getByText('dashboard.mode.off'))
    expect(onmode).toHaveBeenCalledWith(2)
  })

  it('when locked, shows the lock label and does not open a popover', async () => {
    const onmode = vi.fn()
    const { getByText, queryByText, getByRole } = render(ModePill, {
      props: { mode: 0, locked: true, lockLabel: 'RFID', onmode },
    })
    expect(getByText('RFID')).toBeInTheDocument()
    await fireEvent.click(getByRole('button', { name: 'dashboard.mode.aria' }))
    expect(queryByText('dashboard.mode.off')).not.toBeInTheDocument()
    expect(onmode).not.toHaveBeenCalled()
  })

  it('does not open when disabled', async () => {
    const { getByRole, queryByText } = render(ModePill, { props: { mode: 0, disabled: true } })
    await fireEvent.click(getByRole('button', { name: 'dashboard.mode.aria' }))
    expect(queryByText('dashboard.mode.off')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/components/dashboard/__tests__/ModePill.test.js`
Expected: FAIL — cannot resolve `../ModePill.svelte`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/components/dashboard/ModePill.svelte`:

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import Popover from '../ui/Popover.svelte'

  let { mode = 0, locked = false, lockLabel = '', disabled = false, onmode = () => {} } = $props()

  const MODES = [
    { value: 0, key: 'dashboard.mode.auto' },
    { value: 1, key: 'dashboard.mode.on' },
    { value: 2, key: 'dashboard.mode.off' },
  ]

  let open = $state(false)
  let currentKey = $derived((MODES[mode] ?? MODES[0]).key)

  function toggle() {
    if (disabled || locked) return
    open = !open
  }
  function pick(v) {
    open = false
    if (v !== mode) onmode(v)
  }
</script>

<div class="relative inline-block text-center">
  <div class="text-[8px] tracking-wide text-text-dim uppercase">{$_('dashboard.mode.label')}</div>
  <button
    type="button"
    aria-label={$_('dashboard.mode.aria')}
    disabled={disabled || locked}
    onclick={toggle}
    class="rounded-full border bg-surface-2 px-2.5 py-1 text-[13px] font-bold text-text
           disabled:cursor-not-allowed {locked ? 'border-border' : 'border-accent'}"
    class:opacity-40={disabled || locked}
  >
    {#if locked}
      <span>{lockLabel}</span>
    {:else}
      <span>{$_(currentKey)}</span> <span aria-hidden="true">▾</span>
    {/if}
  </button>

  <Popover {open} align="left" onclose={() => (open = false)}>
    <div class="w-36 rounded-xl border border-border bg-surface-2 p-1.5 shadow-xl">
      {#each MODES as opt}
        <button
          type="button"
          onclick={() => pick(opt.value)}
          class="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold
                 {opt.value === mode ? 'bg-accent text-surface' : 'text-text'}"
        >
          {$_(opt.key)}
        </button>
      {/each}
    </div>
  </Popover>
</div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/components/dashboard/__tests__/ModePill.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/dashboard/ModePill.svelte src/lib/components/dashboard/__tests__/ModePill.test.js
git commit -m "feat(dashboard): ModePill — tappable mode pill with popover + locked state

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `Slider` accessible-name prop + `RatePill.svelte`

**Files:**
- Modify: `src/lib/components/ui/Slider.svelte`
- Create: `src/lib/components/dashboard/RatePill.svelte`
- Test: `src/lib/components/dashboard/__tests__/RatePill.test.js`

**Context:** The rate pill opens a popover containing the existing `Slider`. The Dashboard will have two sliders on screen (this one and the SOC bar's), so the rate slider needs an accessible name to be addressable in tests — add an optional `ariaLabel` prop to `Slider`. The pill itself is dimmed/non-interactive when `disabled` (Eco owns the rate, or busy).

- [ ] **Step 1: Add the `ariaLabel` prop to `Slider.svelte`**

In `src/lib/components/ui/Slider.svelte`, add `ariaLabel = ''` to the props destructure:

```js
  let {
    min = 0,
    max = 100,
    step = 1,
    value = 0,
    disabled = false,
    onchange = () => {},
    format = (v) => v,
    ariaLabel = '',
  } = $props()
```

and add the attribute to the `<input type="range" ...>` element (alongside `role="slider"`):

```svelte
    aria-label={ariaLabel || undefined}
```

(This is additive — existing `Slider` usages pass no `ariaLabel` and are unchanged.)

- [ ] **Step 2: Write the failing RatePill test**

Create `src/lib/components/dashboard/__tests__/RatePill.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import RatePill from '../RatePill.svelte'

describe('RatePill', () => {
  it('shows the current amps', () => {
    const { getByText } = render(RatePill, { props: { amps: 32, max: 48 } })
    expect(getByText('32 A')).toBeInTheDocument()
  })

  it('opens the popover and emits onchange from the slider', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(RatePill, { props: { amps: 24, max: 48, onchange } })
    await fireEvent.click(getByRole('button', { name: 'dashboard.rate.aria' }))
    const slider = getByRole('slider', { name: 'dashboard.rate.aria' })
    slider.value = '20'
    await fireEvent.change(slider)
    expect(onchange).toHaveBeenCalledWith(20)
  })

  it('does not open when disabled', async () => {
    const { getByRole, queryByRole } = render(RatePill, { props: { amps: 24, max: 48, disabled: true } })
    await fireEvent.click(getByRole('button', { name: 'dashboard.rate.aria' }))
    expect(queryByRole('slider')).not.toBeInTheDocument()
  })

  it('shows the claimed hint when claimedBy is set', async () => {
    const { getByRole, getByText } = render(RatePill, { props: { amps: 16, max: 48, claimedBy: 'solar' } })
    await fireEvent.click(getByRole('button', { name: 'dashboard.rate.aria' }))
    expect(getByText('dashboard.rate.claimed')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/components/dashboard/__tests__/RatePill.test.js`
Expected: FAIL — cannot resolve `../RatePill.svelte`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/components/dashboard/RatePill.svelte`:

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import Popover from '../ui/Popover.svelte'
  import Slider from '../ui/Slider.svelte'

  let { amps = 6, min = 6, max = 48, claimedBy = '', disabled = false, onchange = () => {} } = $props()

  let open = $state(false)

  function toggle() {
    if (disabled) return
    open = !open
  }
  function commit(v) {
    onchange(v)
  }
</script>

<div class="relative inline-block text-center">
  <div class="text-[8px] tracking-wide text-text-dim uppercase">{$_('dashboard.rate.label')}</div>
  <button
    type="button"
    aria-label={$_('dashboard.rate.aria')}
    {disabled}
    onclick={toggle}
    class="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[13px] font-bold text-text
           disabled:cursor-not-allowed"
    class:opacity-40={disabled}
  >
    <span>{amps} A</span> <span aria-hidden="true">▾</span>
  </button>

  <Popover {open} align="right" onclose={() => (open = false)}>
    <div class="w-56 rounded-xl border border-border bg-surface-2 p-3 shadow-xl">
      <div class="mb-1 text-sm font-bold text-accent">{amps} A</div>
      <Slider {min} {max} step={1} value={amps} ariaLabel={$_('dashboard.rate.aria')} onchange={commit} />
      {#if claimedBy}
        <div class="mt-1 text-[9px] text-text-dim">
          {$_('dashboard.rate.claimed', { values: { client: claimedBy } })}
        </div>
      {/if}
    </div>
  </Popover>
</div>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/components/dashboard/__tests__/RatePill.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Confirm the Slider change didn't break existing Slider tests**

Run: `npx vitest run src/lib/components/dashboard/__tests__/ChargeLimitModal.test.js src/lib/components/dashboard/__tests__/VehicleSocBar.test.js`
Expected: PASS (existing slider-based tests unaffected).

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/ui/Slider.svelte src/lib/components/dashboard/RatePill.svelte src/lib/components/dashboard/__tests__/RatePill.test.js
git commit -m "feat(dashboard): RatePill — amps pill with slider popover; Slider gains ariaLabel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: i18n accessible-name keys

**Files:**
- Modify: `src/lib/i18n/en.json`, `es.json`, `fr.json`, `hu.json`

**Context:** Add `aria` keys under `dashboard.mode` and `dashboard.rate` for the pill buttons (and the rate slider). The mode/rate `label`/`auto`/`on`/`off`/`claimed` keys already exist; only `aria` is new.

- [ ] **Step 1: Add `aria` to `dashboard.mode` and `dashboard.rate` in each locale**

In `src/lib/i18n/en.json`, add `"aria": "Charge mode"` to the `dashboard.mode` object and `"aria": "Charge rate"` to the `dashboard.rate` object. For example `dashboard.rate` becomes:

```json
    "rate": { "label": "Charge rate", "claimed": "Set by {client}", "aria": "Charge rate" },
```

and add `"aria": "Charge mode"` as a new key inside the `dashboard.mode` object (which has `label`/`auto`/`on`/`off`/`locked`).

Repeat with translated strings:
- `es.json`: mode aria `"Modo de carga"`, rate aria `"Velocidad de carga"`
- `fr.json`: mode aria `"Mode de charge"`, rate aria `"Vitesse de charge"`
- `hu.json`: mode aria `"Töltési mód"`, rate aria `"Töltési sebesség"`

- [ ] **Step 2: Verify JSON parses and the suite is still green**

Run: `node -e "['en','es','fr','hu'].forEach(l=>JSON.parse(require('fs').readFileSync('src/lib/i18n/'+l+'.json','utf8')))" && echo OK`
Expected: `OK`

Run: `npm test`
Expected: full suite green (no behavior change yet).

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n/en.json src/lib/i18n/es.json src/lib/i18n/fr.json src/lib/i18n/hu.json
git commit -m "i18n: aria names for the mode/rate pills (en/es/fr/hu)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Wire the pills into `Dashboard.svelte`

**Files:**
- Modify: `src/routes/Dashboard.svelte`
- Test: `src/routes/__tests__/Dashboard.test.js`

**Context:** Swap the imports, add a `modeLockLabel` derived (claim owner → short word), wrap `PowerRing` so the pills sit at its top corners (rendered in all states), and delete the `ModeSelector`/`ChargeRate` instances from the markup. The pills carry the same disabled/locked conditions the rows used. `rateNonce` now wraps `RatePill`.

- [ ] **Step 1: Write the failing/updated tests**

Edit `src/routes/__tests__/Dashboard.test.js`.

Replace the existing test `it('disables mode segments when RFID client owns the state claim', ...)` with:

```js
  it('locks the mode pill to the claim owner (RFID)', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    claims_target_store.set({ properties: {}, claims: { state: EvseClients.rfid.id } })
    const { getByText, queryByText } = render(Dashboard)
    expect(getByText('RFID')).toBeInTheDocument()
    // locked pill renders no popover options
    expect(queryByText('dashboard.mode.off')).not.toBeInTheDocument()
  })
```

Replace the body of `it('surfaces the global alert when a mode write fails', ...)` so it opens the pill first:

```js
  it('surfaces the global alert when a mode write fails', async () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    httpAPI.mockResolvedValue('error')
    const { getByText, getByRole } = render(Dashboard)
    await fireEvent.click(getByRole('button', { name: 'dashboard.mode.aria' }))
    await fireEvent.click(getByText('dashboard.mode.on'))
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })
```

Add two new tests inside the `describe('Dashboard', ...)` block:

```js
  it('renders the mode and rate pills instead of the old rows', () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 32000, session_energy: 0, session_elapsed: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0 })
    const { getByRole } = render(Dashboard)
    expect(getByRole('button', { name: 'dashboard.mode.aria' })).toBeInTheDocument()
    expect(getByRole('button', { name: 'dashboard.rate.aria' })).toBeInTheDocument()
  })

  it('writes the charge rate from the rate pill', async () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 32000, session_energy: 0, session_elapsed: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0 })
    const { getByRole } = render(Dashboard)
    await fireEvent.click(getByRole('button', { name: 'dashboard.rate.aria' }))
    const slider = getByRole('slider', { name: 'dashboard.rate.aria' })
    slider.value = '20'
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/override', expect.stringContaining('"charge_current":20'))
    })
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/routes/__tests__/Dashboard.test.js`
Expected: FAIL — no `dashboard.mode.aria` / `dashboard.rate.aria` buttons yet.

- [ ] **Step 3: Swap the imports**

In `src/routes/Dashboard.svelte`, remove these two import lines:

```js
  import ModeSelector from '../lib/components/dashboard/ModeSelector.svelte'
  import ChargeRate from '../lib/components/dashboard/ChargeRate.svelte'
```

and add:

```js
  import ModePill from '../lib/components/dashboard/ModePill.svelte'
  import RatePill from '../lib/components/dashboard/RatePill.svelte'
```

- [ ] **Step 4: Add the `modeLockLabel` derived**

Immediately after the existing `modeLocked` derived (the `let modeLocked = $derived(... )` block), add:

```js
  let modeLockLabel = $derived(
    claimOwner === EvseClients.ocpp.id
      ? 'OCPP'
      : claimOwner === EvseClients.rfid.id
        ? 'RFID'
        : claimOwner === EvseClients.limit.id
          ? 'LIMIT'
          : '',
  )
```

- [ ] **Step 5: Wrap PowerRing with the pills; remove the old rows**

Replace this markup:

```svelte
  <PowerRing
    {display}
    {fill}
    {kw}
    maxKw={charging ? maxKw : ''}
    reasonKey={reason.key}
    reasonValues={reason.values}
    faultText={getStateDesc($status_store?.state) ?? ''}
  />
```
with:
```svelte
  <div class="relative">
    <div class="absolute left-0 top-1 z-10">
      <ModePill
        {mode}
        locked={modeLocked}
        lockLabel={modeLockLabel}
        disabled={busy || display === 'error'}
        onmode={setMode}
      />
    </div>
    <div class="absolute right-0 top-1 z-10">
      {#key rateNonce}
        <RatePill
          amps={chargeAmps}
          min={6}
          max={maxAmps}
          claimedBy={rateClaimedBy}
          disabled={busy || ecoOn || display === 'error'}
          onchange={setChargeAmps}
        />
      {/key}
    </div>
    <PowerRing
      {display}
      {fill}
      {kw}
      maxKw={charging ? maxKw : ''}
      reasonKey={reason.key}
      reasonValues={reason.values}
      faultText={getStateDesc($status_store?.state) ?? ''}
    />
  </div>
```

Then delete the now-removed `ModeSelector` block:

```svelte
  <ModeSelector
    {mode}
    disabled={busy || modeLocked || display === 'error'}
    onmode={setMode}
  />
```

and the `ChargeRate` block (the `{#key rateNonce} ... {/key}` wrapping `<ChargeRate .../>` that sits just inside `{#if display !== 'error'}`):

```svelte
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
```

(Leave the `{#if display !== 'error'}` block itself — it now starts with the `{#if hasSoc}` SOC-bar block.)

- [ ] **Step 6: Run the Dashboard tests**

Run: `npx vitest run src/routes/__tests__/Dashboard.test.js`
Expected: PASS — the updated RFID/lock test, the mode-write-fail test (now opens the pill), the two new pill tests, and all existing tests.

- [ ] **Step 7: Commit**

```bash
git add src/routes/Dashboard.svelte src/routes/__tests__/Dashboard.test.js
git commit -m "feat(dashboard): mode + rate pills around the ring; drop the two control rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Delete the replaced components and verify

**Files:**
- Delete: `src/lib/components/dashboard/ModeSelector.svelte`
- Delete: `src/lib/components/dashboard/ChargeRate.svelte`
- Delete: `src/lib/components/dashboard/__tests__/ModeSelector.test.js`
- Delete: `src/lib/components/dashboard/__tests__/ChargeRate.test.js`

**Context:** Nothing imports these anymore (Task 5 removed the Dashboard imports). `SegmentedControl` and `Slider`, which they used, stay — they're used by other pages.

- [ ] **Step 1: Confirm there are no remaining references**

Run: `grep -rn "ModeSelector\|ChargeRate" src` 
Expected: no matches (empty output).

- [ ] **Step 2: Delete the four files**

```bash
git rm src/lib/components/dashboard/ModeSelector.svelte \
       src/lib/components/dashboard/ChargeRate.svelte \
       src/lib/components/dashboard/__tests__/ModeSelector.test.js \
       src/lib/components/dashboard/__tests__/ChargeRate.test.js
```

- [ ] **Step 3: Run the full suite and a production build**

Run: `npm test`
Expected: full suite green.

Run: `npm run build`
Expected: clean build, no missing-i18n-key warnings for `dashboard.mode.aria` / `dashboard.rate.aria`, no unresolved-import errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(dashboard): remove ModeSelector/ChargeRate — replaced by pills

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the implementer

- **Popover positioning** relies on each pill's `class="relative inline-block"` wrapper; the panel is `absolute top-full`. Don't remove the relative wrapper.
- **Two sliders on the Dashboard:** the SOC bar's input is named `dashboard.vehicle.target_aria`; the rate slider is named `dashboard.rate.aria`. Always query sliders by `name` in Dashboard tests.
- **Pills render in all ring states** because they live in the ring wrapper, outside the `{#if display !== 'error'}` block — error state just disables them via the `disabled` prop.
- Do not delete `SegmentedControl.svelte` or `Slider.svelte` — other pages use them.
