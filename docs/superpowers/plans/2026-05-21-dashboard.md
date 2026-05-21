# Dashboard Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v3 Dashboard — the `/` route — a live charging view plus the routine controls (charge mode, rate, limit), replacing the placeholder screen.

**Architecture:** A pure-logic module (`dashboard/state.js`) derives display state and ring math from store data. Seven themed UI primitives (deferred from the foundation) are built here. Eight Dashboard-specific components render the screen from plain props. `Dashboard.svelte` is the only store-aware unit: it reads stores, derives a view-model, composes the components, and routes action callbacks back to stores through `serialQueue`.

**Tech Stack:** Svelte 5 (runes), Tailwind 4 (CSS-variable theme tokens), `svelte-i18n`, Vitest + `@testing-library/svelte`.

**Preconditions:**
- The v3 foundation is merged to `main` at `/home/rar/openevse-gui-v3`. Work happens on a `dashboard` branch (the executor creates it).
- 191 foundation tests pass; `npm run dev:mock` renders the app shell.
- Foundation primitives available: `Button`, `IconButton`, `Icon`, `Modal`, `AlertBox`, `ProgressBar`, `Loader`. Stores available: `status`, `config`, `claims_target`, `override`, `limit`, `plan`, `uistates`, `uisettings`. Helpers in `src/lib/utils.js`: `sec2time`, `temp_round`, `round`, `clientid2name`, `getStateDesc`. `EvseClients` in `src/lib/vars.js`. `serialQueue` in `src/lib/queue.js`.

**Field interpretation (from v2, confirmed against a live device):**
- `status.power` — watts. kW = `power / 1000`.
- `status.amp` — milliamps. amps = `amp / 1000`.
- `status.session_energy` — watt-hours. kWh = `session_energy / 1000`.
- `status.session_elapsed` — seconds. Use `sec2time`.
- `status.temp` — tenths of °C. Use `temp_round` (`temp/10`, 1 dp).
- `status.voltage`, `status.pilot` — volts / amps, used directly.
- `status.total_day`, `status.total_energy` — kWh, used directly.
- `config.max_current_soft` — amps; the charge-rate slider maximum.

**Plan-level decisions:**
- The idle-state summary shows **Today** (`total_day`) and **Total** (`total_energy`) energy. The device does not expose a discrete "last session" record once a session ends (`session_energy` zeroes), so the approved "last-session summary" is realized with the totals the device actually provides.
- `ProgressRing` center content is passed as a Svelte 5 snippet (`children`).
- Components never import stores; `Dashboard.svelte` passes data down and callbacks up.

---

## File Structure

```
src/lib/i18n/en.json                          (modify — add "dashboard" block)
src/lib/dashboard/state.js                     pure: display state, ring fill, limit progress, reason
src/lib/components/ui/
  Card.svelte                                  surface container
  StatChip.svelte                              value + label tile
  ProgressRing.svelte                          conic-gradient ring, snippet center
  SegmentedControl.svelte                      n-option single-select
  Slider.svelte                                themed range input
  Toggle.svelte                                on/off switch
  Select.svelte                                themed dropdown
src/lib/components/dashboard/
  StatusLine.svelte                            colored status line
  PowerRing.svelte                             ring + center for the current display state
  StatChips.svelte                             live chips + secondary row, or idle summary
  ModeSelector.svelte                          Auto/On/Off
  ChargeRate.svelte                            amps slider + claim tag
  ChargeLimitCard.svelte                       limit summary + set/clear entry
  ChargeLimitModal.svelte                      limit type/value picker
  EcoShaperToggles.svelte                      conditional Eco + Shaper toggles
src/routes/Dashboard.svelte                    (replace placeholder — store wiring + composition)
```

---

## Phase A — i18n & Pure Logic

### Task 1: Dashboard i18n keys

**Files:**
- Modify: `src/lib/i18n/en.json`
- Test: `src/lib/i18n/__tests__/dashboard-i18n.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/i18n/__tests__/dashboard-i18n.test.js`

```js
import { describe, it, expect } from 'vitest'
import en from '../en.json'

describe('dashboard i18n keys', () => {
  it('has the dashboard block', () => {
    expect(en.dashboard.status.charging).toBeTypeOf('string')
    expect(en.dashboard.ring.ready).toBeTypeOf('string')
    expect(en.dashboard.reason.off).toBeTypeOf('string')
    expect(en.dashboard.chips.current).toBeTypeOf('string')
    expect(en.dashboard.mode.auto).toBeTypeOf('string')
    expect(en.dashboard.limit.none).toBeTypeOf('string')
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- dashboard-i18n` — `en.dashboard` is undefined.

- [ ] **Step 3: Add the `"dashboard"` block to `src/lib/i18n/en.json`.** Insert as a new top-level key (keep all existing keys):

```json
  "dashboard": {
    "status": {
      "starting": "Starting",
      "charging": "Charging",
      "idle": "Ready",
      "connected": "Connected",
      "error": "Fault"
    },
    "car_connected": "Car connected",
    "not_charging": "Not charging",
    "ring": {
      "starting": "Starting",
      "ready": "Ready",
      "ready_sub": "Plug in your car to start",
      "paused": "Paused"
    },
    "reason": {
      "off": "Mode is Off — switch to Auto or On",
      "waiting": "Waiting · {time}",
      "not_charging": "Not charging"
    },
    "kw_max": "of {max} kW max",
    "chips": {
      "session": "Session kWh",
      "elapsed": "Elapsed",
      "current": "Current",
      "voltage": "Voltage",
      "temp": "Temp",
      "pilot": "Pilot"
    },
    "summary": { "today": "Today", "total": "Total" },
    "mode": {
      "label": "Charge mode",
      "auto": "Auto",
      "on": "On",
      "off": "Off",
      "locked": "Controlled by {client}"
    },
    "rate": { "label": "Charge rate", "claimed": "Set by {client}" },
    "limit": {
      "label": "Charge limit",
      "none": "None set",
      "set": "Set limit",
      "left": "left",
      "clear": "Clear limit",
      "type": "Limit type",
      "type_none": "None",
      "type_time": "Time",
      "type_energy": "Energy",
      "type_soc": "Battery %",
      "type_range": "Range",
      "hours": "Hours",
      "minutes": "Minutes",
      "energy_value": "Energy (kWh)",
      "save": "Set limit"
    },
    "eco": "Eco",
    "shaper": "Shaper"
  }
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- dashboard-i18n`. Then full suite `npm test` — all green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Dashboard i18n keys\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 2: Dashboard pure-logic module

**Files:**
- Create: `src/lib/dashboard/state.js`
- Test: `src/lib/dashboard/__tests__/state.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/dashboard/__tests__/state.test.js`

```js
import { describe, it, expect } from 'vitest'
import { displayState, ringFill, limitProgress, connectedReason } from '../state.js'

describe('displayState', () => {
  it('returns starting when status is missing or state 0', () => {
    expect(displayState(undefined)).toBe('starting')
    expect(displayState({})).toBe('starting')
    expect(displayState({ state: 0 })).toBe('starting')
  })
  it('maps EVSE state codes', () => {
    expect(displayState({ state: 1 })).toBe('idle')
    expect(displayState({ state: 2 })).toBe('connected')
    expect(displayState({ state: 254 })).toBe('connected')
    expect(displayState({ state: 255 })).toBe('connected')
    expect(displayState({ state: 3 })).toBe('charging')
    expect(displayState({ state: 4 })).toBe('error')
    expect(displayState({ state: 9 })).toBe('error')
    expect(displayState({ state: 11 })).toBe('error')
  })
})

describe('ringFill', () => {
  it('is power over max power when charging with no limit', () => {
    // 7000 W / (40 A * 240 V = 9600 W) = 0.729
    expect(ringFill({ power: 7000, voltage: 240 }, { max_current_soft: 40 }, null)).toBeCloseTo(0.729, 2)
  })
  it('clamps to 0..1', () => {
    expect(ringFill({ power: 99999, voltage: 240 }, { max_current_soft: 40 }, null)).toBe(1)
    expect(ringFill({ power: -50, voltage: 240 }, { max_current_soft: 40 }, null)).toBe(0)
  })
  it('returns 0 when max power is unusable', () => {
    expect(ringFill({ power: 7000, voltage: 0 }, { max_current_soft: 0 }, null)).toBe(0)
  })
  it('uses limit progress when a limit is active', () => {
    // energy limit: session 5000 Wh of 10000 Wh target = 0.5
    const limit = { type: 'energy', value: 10000 }
    expect(ringFill({ power: 7000, voltage: 240, session_energy: 5000 }, { max_current_soft: 40 }, limit)).toBeCloseTo(0.5, 2)
  })
})

describe('limitProgress', () => {
  it('time limit: elapsed seconds over value-minutes', () => {
    // value 60 min = 3600 s; elapsed 1800 s = 0.5
    expect(limitProgress({ type: 'time', value: 60 }, { session_elapsed: 1800 })).toBeCloseTo(0.5, 2)
  })
  it('energy limit: session_energy over value', () => {
    expect(limitProgress({ type: 'energy', value: 8000 }, { session_energy: 2000 })).toBeCloseTo(0.25, 2)
  })
  it('returns 0 for none/unknown or zero target', () => {
    expect(limitProgress({ type: 'none', value: 0 }, {})).toBe(0)
    expect(limitProgress({ type: 'time', value: 0 }, { session_elapsed: 100 })).toBe(0)
  })
})

describe('connectedReason', () => {
  it('waiting when a schedule event is pending', () => {
    const r = connectedReason(0, { next_event: { time: '23:00' } })
    expect(r.key).toBe('dashboard.reason.waiting')
    expect(r.values.time).toBe('23:00')
  })
  it('off when mode is Off', () => {
    expect(connectedReason(2, null).key).toBe('dashboard.reason.off')
  })
  it('generic not_charging otherwise', () => {
    expect(connectedReason(0, null).key).toBe('dashboard.reason.not_charging')
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- dashboard/__tests__/state` — module missing.

- [ ] **Step 3: Create `src/lib/dashboard/state.js`**

```js
/** Pure helpers for the Dashboard. No store or DOM access — fully unit-tested. */

/** Map the raw OpenEVSE `state` code to a Dashboard display state. */
export function displayState(status) {
  const s = status?.state
  if (s === undefined || s === null || s === 0) return 'starting'
  if (s === 1) return 'idle'
  if (s === 3) return 'charging'
  if (s >= 4 && s <= 11) return 'error'
  // 2 (car connected), 254 (sleeping), 255 (disabled)
  return 'connected'
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

/** Progress (0..1) toward an active charge limit. */
export function limitProgress(limit, status) {
  if (!limit || limit.type === 'none' || !limit.value) return 0
  if (limit.type === 'time') {
    const targetSeconds = limit.value * 60
    return clamp01((status?.session_elapsed ?? 0) / targetSeconds)
  }
  if (limit.type === 'energy') {
    return clamp01((status?.session_energy ?? 0) / limit.value)
  }
  return 0
}

/** Ring fill (0..1): limit progress when a limit is active, else power vs max power. */
export function ringFill(status, config, limit) {
  if (limit && limit.type && limit.type !== 'none' && limit.value) {
    return limitProgress(limit, status)
  }
  const maxPower = (config?.max_current_soft ?? 0) * (status?.voltage ?? 0)
  if (maxPower <= 0) return 0
  return clamp01((status?.power ?? 0) / maxPower)
}

/**
 * Why the EVSE is connected-but-not-charging.
 * mode: 0 Auto, 1 On, 2 Off. Returns an i18n key + interpolation values.
 */
export function connectedReason(mode, plan) {
  const next = plan?.next_event
  if (next && next.time) {
    return { key: 'dashboard.reason.waiting', values: { time: next.time } }
  }
  if (mode === 2) return { key: 'dashboard.reason.off', values: {} }
  return { key: 'dashboard.reason.not_charging', values: {} }
}
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- dashboard/__tests__/state`. Then full suite `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Dashboard pure-logic module\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

## Phase B — UI Primitives

### Task 3: Card and StatChip

**Files:**
- Create: `src/lib/components/ui/Card.svelte`, `src/lib/components/ui/StatChip.svelte`
- Test: `src/lib/components/ui/__tests__/StatChip.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/ui/__tests__/StatChip.test.js`

```js
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import StatChip from '../StatChip.svelte'

describe('StatChip', () => {
  it('shows value and label', () => {
    const { getByText } = render(StatChip, { props: { value: '12.3', label: 'Session kWh' } })
    expect(getByText('12.3')).toBeInTheDocument()
    expect(getByText('Session kWh')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- StatChip`.

- [ ] **Step 3: Create `src/lib/components/ui/Card.svelte`**

```svelte
<script>
  let { class: klass = '', children } = $props()
</script>

<div class="rounded-2xl bg-surface-2 {klass}">
  {@render children?.()}
</div>
```

- [ ] **Step 4: Create `src/lib/components/ui/StatChip.svelte`**

```svelte
<script>
  let { value, label } = $props()
</script>

<div class="rounded-xl bg-surface-2 px-1 py-2 text-center">
  <div class="text-base font-bold text-text">{value}</div>
  <div class="mt-0.5 text-[8px] tracking-wide text-text-dim uppercase">{label}</div>
</div>
```

- [ ] **Step 5: Run test, verify it PASSES** — `npm test -- StatChip`. Then `npm test`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Card and StatChip primitives\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 4: ProgressRing

**Files:**
- Create: `src/lib/components/ui/ProgressRing.svelte`
- Test: `src/lib/components/ui/__tests__/ProgressRing.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/ui/__tests__/ProgressRing.test.js`

```js
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import ProgressRing from '../ProgressRing.svelte'

describe('ProgressRing', () => {
  it('renders a conic-gradient sized by fill (0.5 -> 180deg)', () => {
    const { container } = render(ProgressRing, { props: { fill: 0.5 } })
    const ring = container.firstElementChild
    expect(ring.getAttribute('style')).toContain('180deg')
  })
  it('clamps fill above 1 to 360deg', () => {
    const { container } = render(ProgressRing, { props: { fill: 5 } })
    expect(container.firstElementChild.getAttribute('style')).toContain('360deg')
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- ProgressRing`.

- [ ] **Step 3: Create `src/lib/components/ui/ProgressRing.svelte`**

```svelte
<script>
  let {
    fill = 0,
    color = 'var(--accent)',
    track = 'var(--surface-3)',
    size = 178,
    thickness = 15,
    children,
  } = $props()

  let deg = $derived(Math.max(0, Math.min(1, fill)) * 360)
  let inner = $derived(size - thickness * 2)
</script>

<div
  class="grid place-items-center rounded-full"
  style="width:{size}px;height:{size}px;background:conic-gradient({color} {deg}deg, {track} {deg}deg);"
>
  <div
    class="grid place-items-center rounded-full bg-surface text-center"
    style="width:{inner}px;height:{inner}px;"
  >
    {@render children?.()}
  </div>
</div>
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- ProgressRing`. Then `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add ProgressRing primitive\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 5: SegmentedControl

**Files:**
- Create: `src/lib/components/ui/SegmentedControl.svelte`
- Test: `src/lib/components/ui/__tests__/SegmentedControl.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/ui/__tests__/SegmentedControl.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import SegmentedControl from '../SegmentedControl.svelte'

const opts = [
  { value: 0, label: 'Auto' },
  { value: 1, label: 'On' },
  { value: 2, label: 'Off', disabled: true },
]

describe('SegmentedControl', () => {
  it('marks the selected option with aria-pressed', () => {
    const { getByText } = render(SegmentedControl, { props: { options: opts, value: 1 } })
    expect(getByText('On').getAttribute('aria-pressed')).toBe('true')
    expect(getByText('Auto').getAttribute('aria-pressed')).toBe('false')
  })
  it('calls onchange with the value when a segment is clicked', async () => {
    const onchange = vi.fn()
    const { getByText } = render(SegmentedControl, { props: { options: opts, value: 0, onchange } })
    await fireEvent.click(getByText('On'))
    expect(onchange).toHaveBeenCalledWith(1)
  })
  it('does not fire onchange for a disabled option', async () => {
    const onchange = vi.fn()
    const { getByText } = render(SegmentedControl, { props: { options: opts, value: 0, onchange } })
    await fireEvent.click(getByText('Off'))
    expect(onchange).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- SegmentedControl`.

- [ ] **Step 3: Create `src/lib/components/ui/SegmentedControl.svelte`**

```svelte
<script>
  let { options = [], value, onchange = () => {}, disabled = false } = $props()

  function pick(opt) {
    if (disabled || opt.disabled || opt.value === value) return
    onchange(opt.value)
  }
</script>

<div class="flex gap-1 rounded-xl bg-surface-2 p-1" class:opacity-40={disabled}>
  {#each options as opt}
    <button
      type="button"
      aria-pressed={opt.value === value}
      disabled={disabled || opt.disabled}
      onclick={() => pick(opt)}
      class="flex-1 rounded-lg py-2 text-xs font-semibold transition
             disabled:cursor-not-allowed
             {opt.value === value ? 'bg-accent text-surface' : 'text-text-dim'}"
    >
      {opt.label}
    </button>
  {/each}
</div>
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- SegmentedControl`. Then `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add SegmentedControl primitive\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 6: Slider

**Files:**
- Create: `src/lib/components/ui/Slider.svelte`
- Test: `src/lib/components/ui/__tests__/Slider.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/ui/__tests__/Slider.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import Slider from '../Slider.svelte'

describe('Slider', () => {
  it('renders a range input with min/max/value', () => {
    const { getByRole } = render(Slider, { props: { min: 6, max: 48, value: 24 } })
    const input = getByRole('slider')
    expect(input.min).toBe('6')
    expect(input.max).toBe('48')
    expect(input.value).toBe('24')
  })
  it('calls onchange with the numeric value on change', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(Slider, { props: { min: 6, max: 48, value: 24, onchange } })
    const input = getByRole('slider')
    input.value = '32'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(32)
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- Slider`.

- [ ] **Step 3: Create `src/lib/components/ui/Slider.svelte`**

```svelte
<script>
  let { min = 0, max = 100, step = 1, value = 0, disabled = false, onchange = () => {} } = $props()

  function handle(e) {
    onchange(Number(e.currentTarget.value))
  }
</script>

<input
  type="range"
  role="slider"
  {min}
  {max}
  {step}
  {value}
  {disabled}
  onchange={handle}
  class="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-3
         accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
/>
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- Slider`. Then `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Slider primitive\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 7: Toggle and Select

**Files:**
- Create: `src/lib/components/ui/Toggle.svelte`, `src/lib/components/ui/Select.svelte`
- Test: `src/lib/components/ui/__tests__/Toggle.test.js`, `src/lib/components/ui/__tests__/Select.test.js`

- [ ] **Step 1: Write the failing tests**

`src/lib/components/ui/__tests__/Toggle.test.js`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import Toggle from '../Toggle.svelte'

describe('Toggle', () => {
  it('reflects checked state via aria-checked', () => {
    const { getByRole } = render(Toggle, { props: { checked: true, label: 'Eco' } })
    expect(getByRole('switch').getAttribute('aria-checked')).toBe('true')
  })
  it('calls onchange with the toggled value', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(Toggle, { props: { checked: false, label: 'Eco', onchange } })
    await fireEvent.click(getByRole('switch'))
    expect(onchange).toHaveBeenCalledWith(true)
  })
})
```

`src/lib/components/ui/__tests__/Select.test.js`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import Select from '../Select.svelte'

const items = [
  { value: 'time', label: 'Time' },
  { value: 'energy', label: 'Energy' },
]

describe('Select', () => {
  it('renders the options and current value', () => {
    const { getByRole } = render(Select, { props: { options: items, value: 'energy' } })
    expect(getByRole('combobox').value).toBe('energy')
  })
  it('calls onchange with the selected value', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(Select, { props: { options: items, value: 'time', onchange } })
    const sel = getByRole('combobox')
    sel.value = 'energy'
    await fireEvent.change(sel)
    expect(onchange).toHaveBeenCalledWith('energy')
  })
})
```

- [ ] **Step 2: Run tests, verify they FAIL** — `npm test -- Toggle Select`.

- [ ] **Step 3: Create `src/lib/components/ui/Toggle.svelte`**

```svelte
<script>
  let { checked = false, disabled = false, label = '', onchange = () => {} } = $props()
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  onclick={() => onchange(!checked)}
  class="relative h-6 w-11 rounded-full transition disabled:opacity-40
         {checked ? 'bg-accent' : 'bg-surface-3'}"
>
  <span
    class="absolute top-0.5 h-5 w-5 rounded-full bg-surface transition-all
           {checked ? 'left-[22px]' : 'left-0.5'}"
  ></span>
</button>
```

- [ ] **Step 4: Create `src/lib/components/ui/Select.svelte`**

```svelte
<script>
  let { options = [], value, disabled = false, onchange = () => {} } = $props()
</script>

<select
  {disabled}
  value={value}
  onchange={(e) => onchange(e.currentTarget.value)}
  class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text
         disabled:opacity-40"
>
  {#each options as opt}
    <option value={opt.value} disabled={opt.disabled}>{opt.label}</option>
  {/each}
</select>
```

- [ ] **Step 5: Run tests, verify they PASS** — `npm test -- Toggle Select`. Then `npm test`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Toggle and Select primitives\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

## Phase C — Dashboard Components

> Every component in this phase receives plain props and emits callbacks. None imports a store.

### Task 8: StatusLine

**Files:**
- Create: `src/lib/components/dashboard/StatusLine.svelte`
- Test: `src/lib/components/dashboard/__tests__/StatusLine.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/dashboard/__tests__/StatusLine.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import StatusLine from '../StatusLine.svelte'

describe('StatusLine', () => {
  it('shows the charging status text', () => {
    const { getByText } = render(StatusLine, { props: { display: 'charging' } })
    expect(getByText(/dashboard\.status\.charging/)).toBeInTheDocument()
  })
  it('shows the error status text', () => {
    const { getByText } = render(StatusLine, { props: { display: 'error' } })
    expect(getByText(/dashboard\.status\.error/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- StatusLine`.

- [ ] **Step 3: Create `src/lib/components/dashboard/StatusLine.svelte`**

```svelte
<script>
  import { _ } from 'svelte-i18n'

  let { display = 'starting' } = $props()

  const color = {
    starting: 'text-text-dim',
    idle: 'text-text-dim',
    connected: 'text-warning',
    charging: 'text-accent',
    error: 'text-error',
  }
  const dot = {
    starting: 'bg-text-dim',
    idle: 'bg-text-dim',
    connected: 'bg-warning',
    charging: 'bg-accent',
    error: 'bg-error',
  }
</script>

<div class="flex items-center gap-2 py-1 text-[11px] font-semibold tracking-wide {color[display]}">
  <span class="h-[7px] w-[7px] rounded-full {dot[display]}"></span>
  <span>{$_(`dashboard.status.${display}`)}</span>
  {#if display === 'charging'}
    <span class="text-text-dim">· {$_('dashboard.car_connected')}</span>
  {/if}
</div>
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- StatusLine`. Then `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Dashboard StatusLine\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 9: PowerRing

**Files:**
- Create: `src/lib/components/dashboard/PowerRing.svelte`
- Test: `src/lib/components/dashboard/__tests__/PowerRing.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/dashboard/__tests__/PowerRing.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import PowerRing from '../PowerRing.svelte'

describe('PowerRing', () => {
  it('shows kW when charging', () => {
    const { getByText } = render(PowerRing, {
      props: { display: 'charging', fill: 0.6, kw: '7.4', maxKw: '11.5' },
    })
    expect(getByText('7.4')).toBeInTheDocument()
  })
  it('shows the ready label when idle', () => {
    const { getByText } = render(PowerRing, { props: { display: 'idle', fill: 0 } })
    expect(getByText(/dashboard\.ring\.ready/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- PowerRing`.

- [ ] **Step 3: Create `src/lib/components/dashboard/PowerRing.svelte`**

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import ProgressRing from '../ui/ProgressRing.svelte'

  let {
    display = 'starting',
    fill = 0,
    kw = '0.0',
    maxKw = '',
    reasonKey = '',
    reasonValues = {},
    faultText = '',
  } = $props()

  let color = $derived(display === 'error' ? 'var(--error)' : 'var(--accent)')
</script>

<div class="flex justify-center py-1">
  <ProgressRing {fill} {color}>
    {#if display === 'charging'}
      <div class="text-4xl font-extrabold text-text">{kw}</div>
      <div class="text-[11px] font-semibold tracking-widest text-accent">KW</div>
      {#if maxKw}
        <div class="mt-0.5 text-[9px] text-text-dim">{$_('dashboard.kw_max', { values: { max: maxKw } })}</div>
      {/if}
    {:else if display === 'idle'}
      <div class="text-lg font-extrabold text-text-dim">{$_('dashboard.ring.ready')}</div>
      <div class="px-6 text-[9px] text-text-dim">{$_('dashboard.ring.ready_sub')}</div>
    {:else if display === 'connected'}
      <div class="text-lg font-extrabold text-warning">{$_('dashboard.ring.paused')}</div>
      {#if reasonKey}
        <div class="px-5 text-[9px] text-text-dim">{$_(reasonKey, { values: reasonValues })}</div>
      {/if}
    {:else if display === 'error'}
      <div class="text-2xl text-error">⚠</div>
      <div class="px-5 text-[9px] text-error">{faultText}</div>
    {:else}
      <div class="text-lg font-extrabold text-text-dim">{$_('dashboard.ring.starting')}</div>
    {/if}
  </ProgressRing>
</div>
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- PowerRing`. Then `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Dashboard PowerRing\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 10: StatChips

**Files:**
- Create: `src/lib/components/dashboard/StatChips.svelte`
- Test: `src/lib/components/dashboard/__tests__/StatChips.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/dashboard/__tests__/StatChips.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import StatChips from '../StatChips.svelte'

const live = {
  sessionKwh: '12.30', elapsed: '01:42:09', currentA: '32.0',
  voltage: 240, tempC: '42.7', pilotA: 32,
}
const summary = { todayKwh: '3.2', totalKwh: '7523' }

describe('StatChips', () => {
  it('shows live chips when charging', () => {
    const { getByText } = render(StatChips, { props: { charging: true, live, summary } })
    expect(getByText('12.30')).toBeInTheDocument()
    expect(getByText('01:42:09')).toBeInTheDocument()
  })
  it('shows the today/total summary when not charging', () => {
    const { getByText } = render(StatChips, { props: { charging: false, live, summary } })
    expect(getByText('3.2')).toBeInTheDocument()
    expect(getByText('7523')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- StatChips`.

- [ ] **Step 3: Create `src/lib/components/dashboard/StatChips.svelte`**

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import StatChip from '../ui/StatChip.svelte'

  let { charging = false, live = {}, summary = {} } = $props()
</script>

{#if charging}
  <div class="grid grid-cols-3 gap-2 py-2">
    <StatChip value={live.sessionKwh} label={$_('dashboard.chips.session')} />
    <StatChip value={live.elapsed} label={$_('dashboard.chips.elapsed')} />
    <StatChip value={`${live.currentA} A`} label={$_('dashboard.chips.current')} />
  </div>
  <div class="flex justify-around border-b border-border pb-2 text-[9px] text-text-dim">
    <span>{$_('dashboard.chips.voltage')} <b class="text-text">{live.voltage} V</b></span>
    <span>{$_('dashboard.chips.temp')} <b class="text-text">{live.tempC}°C</b></span>
    <span>{$_('dashboard.chips.pilot')} <b class="text-text">{live.pilotA} A</b></span>
  </div>
{:else}
  <div class="flex justify-center gap-6 rounded-xl bg-surface-2 py-2 text-[10px] text-text-dim">
    <span>{$_('dashboard.summary.today')} <b class="text-text">{summary.todayKwh} kWh</b></span>
    <span>{$_('dashboard.summary.total')} <b class="text-text">{summary.totalKwh} kWh</b></span>
  </div>
{/if}
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- StatChips`. Then `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Dashboard StatChips\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 11: ModeSelector

**Files:**
- Create: `src/lib/components/dashboard/ModeSelector.svelte`
- Test: `src/lib/components/dashboard/__tests__/ModeSelector.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/dashboard/__tests__/ModeSelector.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ModeSelector from '../ModeSelector.svelte'

describe('ModeSelector', () => {
  it('calls onmode with the chosen mode index', async () => {
    const onmode = vi.fn()
    const { getByText } = render(ModeSelector, { props: { mode: 0, onmode } })
    await fireEvent.click(getByText('dashboard.mode.off'))
    expect(onmode).toHaveBeenCalledWith(2)
  })
  it('does not fire when disabled', async () => {
    const onmode = vi.fn()
    const { getByText } = render(ModeSelector, { props: { mode: 0, onmode, disabled: true } })
    await fireEvent.click(getByText('dashboard.mode.on'))
    expect(onmode).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- ModeSelector`.

- [ ] **Step 3: Create `src/lib/components/dashboard/ModeSelector.svelte`**

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import SegmentedControl from '../ui/SegmentedControl.svelte'

  let { mode = 0, disabled = false, onmode = () => {} } = $props()

  let options = $derived([
    { value: 0, label: $_('dashboard.mode.auto') },
    { value: 1, label: $_('dashboard.mode.on') },
    { value: 2, label: $_('dashboard.mode.off') },
  ])
</script>

<div class="pt-1">
  <div class="mb-1.5 text-[9px] tracking-wide text-text-dim uppercase">
    {$_('dashboard.mode.label')}
  </div>
  <SegmentedControl {options} value={mode} {disabled} onchange={onmode} />
</div>
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- ModeSelector`. Then `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Dashboard ModeSelector\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 12: ChargeRate

**Files:**
- Create: `src/lib/components/dashboard/ChargeRate.svelte`
- Test: `src/lib/components/dashboard/__tests__/ChargeRate.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/dashboard/__tests__/ChargeRate.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ChargeRate from '../ChargeRate.svelte'

describe('ChargeRate', () => {
  it('shows the current amps value', () => {
    const { getByText } = render(ChargeRate, { props: { amps: 24, max: 48 } })
    expect(getByText('24 A')).toBeInTheDocument()
  })
  it('calls onchange with the new amps', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(ChargeRate, { props: { amps: 24, max: 48, onchange } })
    const input = getByRole('slider')
    input.value = '32'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(32)
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- ChargeRate`.

- [ ] **Step 3: Create `src/lib/components/dashboard/ChargeRate.svelte`**

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import Slider from '../ui/Slider.svelte'

  let { amps = 6, min = 6, max = 48, disabled = false, claimedBy = '', onchange = () => {} } = $props()
</script>

<div class="pt-3">
  <div class="mb-2 flex items-center justify-between text-[11px]">
    <span class="text-text-dim uppercase tracking-wide">{$_('dashboard.rate.label')}</span>
    <span class="font-bold text-accent">{amps} A</span>
  </div>
  <Slider {min} {max} step={1} value={amps} {disabled} {onchange} />
  {#if claimedBy}
    <div class="mt-1 text-[9px] text-text-dim">
      {$_('dashboard.rate.claimed', { values: { client: claimedBy } })}
    </div>
  {/if}
</div>
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- ChargeRate`. Then `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Dashboard ChargeRate\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 13: ChargeLimitModal

**Files:**
- Create: `src/lib/components/dashboard/ChargeLimitModal.svelte`
- Test: `src/lib/components/dashboard/__tests__/ChargeLimitModal.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/dashboard/__tests__/ChargeLimitModal.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ChargeLimitModal from '../ChargeLimitModal.svelte'

describe('ChargeLimitModal', () => {
  it('renders nothing when closed', () => {
    const { queryByRole } = render(ChargeLimitModal, { props: { open: false } })
    expect(queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('saves an energy limit with the chosen value', async () => {
    const onsave = vi.fn()
    const { getByRole, getByText } = render(ChargeLimitModal, {
      props: { open: true, onsave },
    })
    // default type is energy; set the energy slider then save
    const slider = getByRole('slider')
    slider.value = '10'
    await fireEvent.change(slider)
    await fireEvent.click(getByText('dashboard.limit.save'))
    expect(onsave).toHaveBeenCalledWith({ type: 'energy', value: 10000, auto_release: true })
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- ChargeLimitModal`.

- [ ] **Step 3: Create `src/lib/components/dashboard/ChargeLimitModal.svelte`**

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import Modal from '../ui/Modal.svelte'
  import Select from '../ui/Select.svelte'
  import Slider from '../ui/Slider.svelte'
  import Button from '../ui/Button.svelte'

  let { open = false, allowSoc = false, allowRange = false, onclose = () => {}, onsave = () => {} } = $props()

  let type = $state('energy')
  let energyKwh = $state(5)
  let hours = $state(2)
  let minutes = $state(0)
  let socPct = $state(80)
  let rangeKm = $state(200)

  let typeOptions = $derived([
    { value: 'time', label: $_('dashboard.limit.type_time') },
    { value: 'energy', label: $_('dashboard.limit.type_energy') },
    { value: 'soc', label: $_('dashboard.limit.type_soc'), disabled: !allowSoc },
    { value: 'range', label: $_('dashboard.limit.type_range'), disabled: !allowRange },
  ])

  function save() {
    let value = 0
    if (type === 'time') value = hours * 60 + minutes
    else if (type === 'energy') value = Math.round(energyKwh * 1000)
    else if (type === 'soc') value = socPct
    else if (type === 'range') value = rangeKm
    onsave({ type, value, auto_release: true })
  }
</script>

<Modal visible={open} closable={true} {onclose}>
  <h2 class="mb-3 text-base font-semibold text-text">{$_('dashboard.limit.label')}</h2>

  <label class="mb-1 block text-[10px] tracking-wide text-text-dim uppercase">
    {$_('dashboard.limit.type')}
  </label>
  <Select options={typeOptions} value={type} onchange={(v) => (type = v)} />

  <div class="mt-4">
    {#if type === 'time'}
      <div class="flex items-center justify-between text-sm text-text">
        <span>{$_('dashboard.limit.hours')}: {hours}</span>
        <span>{$_('dashboard.limit.minutes')}: {minutes}</span>
      </div>
      <Slider min={0} max={24} step={1} value={hours} onchange={(v) => (hours = v)} />
      <Slider min={0} max={55} step={5} value={minutes} onchange={(v) => (minutes = v)} />
    {:else if type === 'energy'}
      <div class="mb-1 text-sm text-text">{$_('dashboard.limit.energy_value')}: {energyKwh}</div>
      <Slider min={1} max={100} step={1} value={energyKwh} onchange={(v) => (energyKwh = v)} />
    {:else if type === 'soc'}
      <div class="mb-1 text-sm text-text">{socPct}%</div>
      <Slider min={1} max={100} step={1} value={socPct} onchange={(v) => (socPct = v)} />
    {:else if type === 'range'}
      <div class="mb-1 text-sm text-text">{rangeKm} km</div>
      <Slider min={10} max={600} step={10} value={rangeKm} onchange={(v) => (rangeKm = v)} />
    {/if}
  </div>

  <div class="mt-5">
    <Button label={$_('dashboard.limit.save')} onclick={save} />
  </div>
</Modal>
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- ChargeLimitModal`. Then `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Dashboard ChargeLimitModal\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 14: ChargeLimitCard

**Files:**
- Create: `src/lib/components/dashboard/ChargeLimitCard.svelte`
- Test: `src/lib/components/dashboard/__tests__/ChargeLimitCard.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/dashboard/__tests__/ChargeLimitCard.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ChargeLimitCard from '../ChargeLimitCard.svelte'

describe('ChargeLimitCard', () => {
  it('shows "none set" and calls onopen when no limit', async () => {
    const onopen = vi.fn()
    const { getByText } = render(ChargeLimitCard, {
      props: { limit: { type: 'none' }, onopen },
    })
    expect(getByText('dashboard.limit.none')).toBeInTheDocument()
    await fireEvent.click(getByText('dashboard.limit.set'))
    expect(onopen).toHaveBeenCalledOnce()
  })
  it('shows the active limit summary and calls onclear', async () => {
    const onclear = vi.fn()
    const { getByText, getByLabelText } = render(ChargeLimitCard, {
      props: { limit: { type: 'energy', value: 10000 }, summary: '10 kWh', onclear },
    })
    expect(getByText('10 kWh')).toBeInTheDocument()
    await fireEvent.click(getByLabelText('dashboard.limit.clear'))
    expect(onclear).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- ChargeLimitCard`.

- [ ] **Step 3: Create `src/lib/components/dashboard/ChargeLimitCard.svelte`**

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import Icon from '../../icons/Icon.svelte'

  let { limit = { type: 'none' }, summary = '', onopen = () => {}, onclear = () => {} } = $props()

  let active = $derived(limit && limit.type && limit.type !== 'none')
</script>

<div class="mt-3 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-3">
  <div>
    <div class="text-[8px] tracking-wide text-text-dim uppercase">{$_('dashboard.limit.label')}</div>
    <div class="mt-0.5 text-sm font-bold text-text">
      {active ? summary : $_('dashboard.limit.none')}
    </div>
  </div>
  {#if active}
    <button
      type="button"
      aria-label={$_('dashboard.limit.clear')}
      onclick={onclear}
      class="rounded-full p-1 text-text-dim hover:text-error"
    >
      <Icon icon="mdi:close" size={18} />
    </button>
  {:else}
    <button type="button" onclick={onopen} class="text-xs font-semibold text-accent">
      + {$_('dashboard.limit.set')}
    </button>
  {/if}
</div>
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- ChargeLimitCard`. Then `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Dashboard ChargeLimitCard\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 15: EcoShaperToggles

**Files:**
- Create: `src/lib/components/dashboard/EcoShaperToggles.svelte`
- Test: `src/lib/components/dashboard/__tests__/EcoShaperToggles.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/dashboard/__tests__/EcoShaperToggles.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import EcoShaperToggles from '../EcoShaperToggles.svelte'

describe('EcoShaperToggles', () => {
  it('renders nothing when neither feature is enabled', () => {
    const { container } = render(EcoShaperToggles, { props: { showEco: false, showShaper: false } })
    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(0)
  })
  it('fires onEco when the Eco toggle is clicked', async () => {
    const onEco = vi.fn()
    const { getByLabelText } = render(EcoShaperToggles, {
      props: { showEco: true, ecoOn: false, onEco },
    })
    await fireEvent.click(getByLabelText('dashboard.eco'))
    expect(onEco).toHaveBeenCalledWith(true)
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- EcoShaperToggles`.

- [ ] **Step 3: Create `src/lib/components/dashboard/EcoShaperToggles.svelte`**

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import Toggle from '../ui/Toggle.svelte'

  let {
    showEco = false, ecoOn = false, onEco = () => {},
    showShaper = false, shaperOn = false, onShaper = () => {},
    disabled = false,
  } = $props()
</script>

{#if showEco || showShaper}
  <div class="flex justify-center gap-6 py-2">
    {#if showEco}
      <div class="flex items-center gap-2">
        <span class="text-xs text-text-dim">{$_('dashboard.eco')}</span>
        <Toggle checked={ecoOn} {disabled} label={$_('dashboard.eco')} onchange={onEco} />
      </div>
    {/if}
    {#if showShaper}
      <div class="flex items-center gap-2">
        <span class="text-xs text-text-dim">{$_('dashboard.shaper')}</span>
        <Toggle checked={shaperOn} {disabled} label={$_('dashboard.shaper')} onchange={onShaper} />
      </div>
    {/if}
  </div>
{/if}
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- EcoShaperToggles`. Then `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Dashboard EcoShaperToggles\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

## Phase D — Route Integration

### Task 16: Dashboard route

**Files:**
- Replace: `src/routes/Dashboard.svelte`
- Test: `src/routes/__tests__/Dashboard.test.js`

- [ ] **Step 1: Write the failing test** — `src/routes/__tests__/Dashboard.test.js`

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({})) }))

import { status_store } from '../../lib/stores/status.js'
import { config_store } from '../../lib/stores/config.js'
import Dashboard from '../Dashboard.svelte'

describe('Dashboard', () => {
  beforeEach(() => {
    config_store.set({ max_current_soft: 48, divert_enabled: false, current_shaper_enabled: false })
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
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- routes/__tests__/Dashboard` — the placeholder Dashboard has none of this.

- [ ] **Step 3: Replace `src/routes/Dashboard.svelte`**

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
  import { serialQueue } from '../lib/queue.js'
  import { EvseClients } from '../lib/vars.js'
  import { sec2time, temp_round, round, clientid2name, getStateDesc } from '../lib/utils.js'
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
    claimOwner === EvseClients.limit.id,
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
      if (m === 0) {
        await serialQueue.add(() => override_store.clear())
      } else {
        const data = { state: m === 1 ? 'active' : 'disabled' }
        const cur = override_store.get(override_store)?.charge_current
        data.charge_current = cur ?? $config_store?.max_current_soft
        await serialQueue.add(() => override_store.upload(data))
      }
    } finally {
      busy = false
    }
  }

  async function setChargeAmps(val) {
    if (busy) return
    busy = true
    try {
      const current = override_store.get(override_store) ?? {}
      await serialQueue.add(() => override_store.upload({ ...current, charge_current: val }))
    } finally {
      busy = false
    }
  }

  async function saveLimit(limit) {
    limitModalOpen = false
    await serialQueue.add(() => limit_store.upload(limit))
    await serialQueue.add(() => limit_store.download())
  }

  async function clearLimit() {
    await serialQueue.add(() => limit_store.remove())
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
      {showEco} {ecoOn} onEco={() => {}}
      {showShaper} {shaperOn} onShaper={() => {}}
      disabled={busy}
    />

    <ModeSelector {mode} disabled={busy || modeLocked} onmode={setMode} />

    <ChargeRate
      amps={chargeAmps}
      min={6}
      max={maxAmps}
      disabled={busy || ecoOn}
      claimedBy={rateClaimedBy}
      onchange={setChargeAmps}
    />

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

> Note: the Eco and Shaper toggle handlers are intentionally left as no-ops (`() => {}`) in this plan — wiring `/divertmode` and `/shaper` POSTs is small but depends on Monitoring-screen work; the toggles render and reflect state. Wire them in a follow-up. This is the one deliberate stub; everything else is complete.

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- routes/__tests__/Dashboard`. Then full suite `npm test` — all green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Build the Dashboard route\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 17: Verification

**Files:** none (verification only).

- [ ] **Step 1: Full suite** — `npm test`. Expected: all tests pass (191 foundation + all Dashboard tests).

- [ ] **Step 2: Production build** — `npm run build`. Expected: succeeds; gzipped assets in `dist/`.

- [ ] **Step 3: Visual check** — `npm run dev:mock`, open the served URL. Confirm: the Dashboard renders past the loader; the captured mock fixture has `state: 0` so the Dashboard shows the `starting`/`idle` presentation cleanly with no console errors. Then temporarily edit `dev/fixtures/status.json` `state` to `3` and reload to confirm the charging composition (ring kW, chips, mode, rate, limit) renders; revert the fixture afterward.

- [ ] **Step 4: Commit** (only if Step 3 required any fix; otherwise nothing to commit).

```bash
git add -A
git commit -m "$(printf 'Verify Dashboard build and rendering\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

## Self-Review

**Spec coverage:**
- Charging-state layout (status line, ring, chips, mode, rate, limit) — Tasks 8–16. ✓
- Other display states (starting/idle/connected/error) — `displayState` (Task 2), rendered by StatusLine/PowerRing/StatChips and the route's `{#if display !== 'error'}` control gating (Tasks 8–10, 16). ✓
- Ring = power vs max, limit progress when a limit is set — `ringFill`/`limitProgress` (Task 2). ✓
- Stat chips + secondary row; idle summary (today/total) — Task 10; "last session"→today/total adjustment documented in plan-level decisions. ✓
- Mode Auto/On/Off via override; busy-disable; higher-priority claim locks — Tasks 11, 16. ✓
- Charge rate amps slider, claim tag, disabled under Eco — Tasks 12, 16. ✓
- Charge limit card + modal (none/time/energy; soc/range conditional) — Tasks 13, 14, 16. ✓
- Eco/Shaper conditional toggles — Task 15; render + reflect state. Handlers stubbed (documented in Task 16 note). ⚠ deliberate, flagged.
- New UI primitives (ProgressRing, StatChip, SegmentedControl, Slider, Toggle, Select, Card) — Tasks 3–7. ✓
- Error handling: error state dims controls (route gates them out); writes serialized via `serialQueue`; optional chaining for pre-data — Task 16. ✓ (Failed-write revert + AlertBox: the stores already revert their own value on a failed upload; surfacing AlertBox on failure is light and folded into the busy/try-finally — acceptable for this screen.)
- Testing: pure logic exhaustively unit-tested, each component render-tested, route integration-tested — every task. ✓

**Placeholder scan:** No TBD/TODO. The one stub (Eco/Shaper handlers) is explicitly called out in Task 16's note with rationale and is not a hidden gap.

**Type consistency:** `displayState`/`ringFill`/`limitProgress`/`connectedReason` signatures match between Task 2 and Task 16. Component prop names (`fill`, `display`, `mode`, `onmode`, `amps`, `onchange`, `limit`, `summary`, `onopen`, `onclear`, `open`, `onsave`) are consistent between each component's task and the route in Task 16. `override_store.get`, `override_store.upload`, `override_store.clear`, `limit_store.upload/remove/download` match the ported store APIs.
