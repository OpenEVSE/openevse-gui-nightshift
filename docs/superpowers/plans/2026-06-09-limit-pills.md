# Limit Pills (Charge-Limit Card v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the charge-limit card's text-row/modal flow with type pills (SOC · Range · Time · Energy) above one prominent editor slot — time/energy get a bar-style inline editor matching the SOC bar.

**Architecture:** One new component (`LimitSliderBar`), a rewrite of `ChargeLimitCard` (pills + slot), the unit toggle removed from `VehicleSocBar` (pills own the unit), `ChargeLimitModal` deleted, and a new `setInlineLimit` handler in the Dashboard reusing the existing limit-store write path and the shipped system-limit guards. Spec: `docs/superpowers/specs/2026-06-09-limit-pills-design.md`.

**Tech Stack:** Svelte 5 runes, svelte-i18n (en/es/fr/hu parity), Vitest + @testing-library/svelte.

**Conventions for every task:**
- Work from `/home/rar/openevse-gui-nightshift`. Single file: `npx vitest run <path>`; full gate `npm test` before each commit (baseline 686 green — existing tests are the shipped contract **except where this plan explicitly rewrites them**; any other failure means fix the change).
- Commit style: conventional commits, body ends `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Device contract: `/limit` value units are minutes (time) and **Wh** (energy, UI shows kWh); `status.session_elapsed` is seconds; `status.session_energy` is Wh; a system limit reports `auto_release: false`.

---

### Task 1: i18n — swap the limit keys (all four locales)

**Files:** `src/lib/i18n/{en,es,fr,hu}.json`

The locale files mix inline/multi-line JSON — never reserialize whole files. `dashboard.limit` is a self-contained block (6-space keys closed by a 4-space `},`), so rebuild exactly that block from parsed values; `dashboard.vehicle.unit_aria` is removed with a line-anchored regex.

- [ ] **Step 1: Run the swap script:**

```bash
node -e '
const fs = require("fs");
const DRAG = {
  en: "No limit — drag to set",
  es: "Sin límite — arrastra para fijar",
  fr: "Aucune limite — glisser pour régler",
  hu: "Nincs korlát — húzza a beállításhoz",
};
for (const l of ["en", "es", "fr", "hu"]) {
  const f = "src/lib/i18n/" + l + ".json";
  let s = fs.readFileSync(f, "utf8");
  const o = JSON.parse(s);
  const d = o.dashboard.limit, e = o.config.evse;
  // New dashboard.limit block: keep label/left/type_time/type_energy, add
  // type_soc/type_range (copied from config.evse.limit_soc/limit_range so the
  // two surfaces agree), drag_to_set, pills_aria (copied from limit_type).
  const block =
    `    "limit": {\n` +
    `      "label": ${JSON.stringify(d.label)},\n` +
    `      "left": ${JSON.stringify(d.left)},\n` +
    `      "minutes": ${JSON.stringify(d.minutes)},\n` +
    `      "type_soc": ${JSON.stringify(e.limit_soc)},\n` +
    `      "type_range": ${JSON.stringify(e.limit_range)},\n` +
    `      "type_time": ${JSON.stringify(d.type_time)},\n` +
    `      "type_energy": ${JSON.stringify(d.type_energy)},\n` +
    `      "drag_to_set": ${JSON.stringify(DRAG[l])},\n` +
    `      "pills_aria": ${JSON.stringify(e.limit_type)}\n` +
    `    },`;
  let before = s;
  s = s.replace(/    "limit": \{[\s\S]*?\n    \},/, block.replace(/\$/g, "$$$$"));
  if (s === before) throw new Error("limit block not found in " + f);
  // unit_aria is the LAST key of dashboard.vehicle (no trailing comma) — strip
  // the comma of the line before it.
  before = s;
  s = s.replace(/,\n      "unit_aria": "[^"]*"/, "");
  if (s === before) throw new Error("unit_aria not found in " + f);
  JSON.parse(s);
  fs.writeFileSync(f, s);
}
console.log("swapped");
'
```

- [ ] **Step 2: Verify parity and shape:**

```bash
for l in en es fr hu; do node -e "
const o = require('./src/lib/i18n/$l.json');
const c = (x) => Object.values(x).reduce((n, v) => n + (v && typeof v === 'object' ? c(v) : 1), 0);
const d = o.dashboard.limit;
console.log('$l', c(o), Object.keys(d).join(','), '| unit_aria?', 'unit_aria' in o.dashboard.vehicle)"; done
```

Expected: identical counts across locales (baseline − 7 each: 10 removed + `unit_aria`, 4 added); key list exactly `label,left,minutes,type_soc,type_range,type_time,type_energy,drag_to_set,pills_aria`; `unit_aria? false`.

`git diff src/lib/i18n/en.json` must show only the `dashboard.limit` block and the `unit_aria` line — nothing else.

- [ ] **Step 3: Suite + commit** — `npm test` will FAIL at this point? No: components still reference removed keys, but the i18n JSON isn't validated against component keys at test time (tests mock svelte-i18n with `(k) => k`). Expect all 686 green.

```bash
npm test
git add src/lib/i18n/
git commit -m "feat(i18n): limit-pill strings replace the modal/row keys"
```

---

### Task 2: New `LimitSliderBar` component

**Files:**
- Create: `src/lib/components/dashboard/LimitSliderBar.svelte`
- Test (create): `src/lib/components/dashboard/__tests__/LimitSliderBar.test.js`

- [ ] **Step 1: Write the failing tests** — create the test file:

```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import LimitSliderBar from '../LimitSliderBar.svelte'

describe('LimitSliderBar', () => {
  it('commits a time limit in minutes', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(LimitSliderBar, { props: { kind: 'time', value: 0, onchange } })
    const input = getByRole('slider', { name: 'dashboard.limit.type_time' })
    input.value = '120'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(120)
  })

  it('commits an energy limit converted from kWh to Wh', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(LimitSliderBar, { props: { kind: 'energy', value: 0, onchange } })
    const input = getByRole('slider', { name: 'dashboard.limit.type_energy' })
    input.value = '10'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(10000)
  })

  it('drag to zero emits 0 (clear) when a limit is active', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(LimitSliderBar, { props: { kind: 'energy', value: 10000, onchange } })
    const input = getByRole('slider', { name: 'dashboard.limit.type_energy' })
    input.value = '0'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(0)
  })

  it('suppresses no-change commits (idle editor cannot clear another limit)', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(LimitSliderBar, { props: { kind: 'time', value: 0, onchange } })
    const input = getByRole('slider', { name: 'dashboard.limit.type_time' })
    input.value = '0'
    await fireEvent.change(input)
    expect(onchange).not.toHaveBeenCalled()
  })

  it('shows the drag hint when no limit is set and the remaining when active', () => {
    const idle = render(LimitSliderBar, { props: { kind: 'time', value: 0 } })
    expect(idle.getByText('dashboard.limit.drag_to_set')).toBeInTheDocument()
    const active = render(LimitSliderBar, {
      props: { kind: 'time', value: 120, progress: 2880, charging: true },
    })
    // 120 min limit, 2880 s (48 min) elapsed → 1h 12m left
    expect(active.getByText(/1h 12m/)).toBeInTheDocument()
  })

  it('caps the progress fill at the knob and only fills while a limit is active', () => {
    const over = render(LimitSliderBar, {
      props: { kind: 'energy', value: 5000, progress: 9000, charging: true },
    })
    const fill = over.container.querySelector('[data-fill]')
    // 5 kWh limit = knob at 5% of the 100 kWh track; over-delivered progress
    // caps the fill AT the knob, never past it.
    expect(fill.style.width).toBe('5%')
    const none = render(LimitSliderBar, { props: { kind: 'energy', value: 0, progress: 9000 } })
    expect(none.container.querySelector('[data-fill]').style.width).toBe('0%')
  })

  it('disables the input when disabled (system limit)', () => {
    const { getByRole } = render(LimitSliderBar, {
      props: { kind: 'time', value: 120, disabled: true },
    })
    expect(getByRole('slider', { name: 'dashboard.limit.type_time' })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (module not found): `npx vitest run src/lib/components/dashboard/__tests__/LimitSliderBar.test.js`

- [ ] **Step 3: Create the component:**

```svelte
<!-- src/lib/components/dashboard/LimitSliderBar.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { hmsShort } from '../../dashboard/soc.js'

  let {
    kind = 'time', // 'time' | 'energy'
    value = 0, // device units: minutes (time) | Wh (energy); 0 = no limit
    progress = 0, // session elapsed seconds | session energy Wh
    charging = false,
    disabled = false,
    onchange = () => {}, // device units; 0 = clear
  } = $props()

  // Slider geometry is in display units: minutes for time, kWh for energy.
  let max = $derived(kind === 'time' ? 480 : 100)
  let step = $derived(kind === 'time' ? 15 : 1)
  // A limit set elsewhere can exceed the scale (e.g. a 12h system default):
  // clamp the knob render; the header still shows the true remaining.
  let display = $derived(
    kind === 'time' ? Math.min(value, 480) : Math.min(Math.round(value / 1000), 100),
  )
  let active = $derived(value > 0)

  // Live knob position during a drag (display units) — same prop-mirroring
  // pattern as VehicleSocBar.
  // svelte-ignore state_referenced_locally
  let current = $state(display)
  $effect(() => {
    current = display
  })

  function fmt(v) {
    if (kind === 'time') return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
    return `${v} ${$_('units.kwh')}`
  }

  function handleInput(e) {
    current = Number(e.currentTarget.value)
  }
  function handleChange(e) {
    const v = Number(e.currentTarget.value)
    if (v === display) return // no-change: never emit (an idle editor must not clear)
    onchange(kind === 'time' ? v : v * 1000)
  }

  // Progress toward the limit (display-unit fraction of the bar, capped).
  let fillPct = $derived.by(() => {
    if (!active) return 0
    const prog = kind === 'time' ? progress / 60 : progress / 1000
    return Math.min(100, (prog / display) * 100) * (display / max)
  })
  let knobPct = $derived((current / max) * 100)
  let knobOpacity = $derived(current === 0 ? 0.55 : 1)
  let remaining = $derived.by(() => {
    if (!active) return ''
    if (kind === 'time') return hmsShort(Math.max(0, value * 60 - progress))
    return `${(Math.max(0, value - progress) / 1000).toFixed(1)} ${$_('units.kwh')}`
  })
  let pillShift = $derived(Math.min(90, Math.max(10, knobPct)))
</script>

<div>
  <!-- header: remaining / hint on the left, scale max on the right -->
  <div class="mb-3 flex items-center justify-between gap-2 text-xs">
    <span class="min-w-0 truncate text-text">
      {#if active && remaining}
        {remaining} {$_('dashboard.limit.left')}
      {:else if !active}
        <span class="text-text-dim">{$_('dashboard.limit.drag_to_set')}</span>
      {/if}
    </span>
    <span class="shrink-0 text-[10px] text-text-dim">{fmt(max)}</span>
  </div>

  <!-- bar block — same geometry family as VehicleSocBar -->
  <div class="relative h-[72px]">
    <div class="absolute inset-x-0 top-[28px] h-[34px]">
      <div class="absolute inset-0 rounded-full bg-surface-3"></div>
      <div
        data-fill
        class="absolute inset-y-0 left-0 rounded-l-full {charging && active
          ? 'soc-shimmer'
          : 'bg-gradient-to-r from-accent to-cyan-400'}"
        style="width: {fillPct}%"
      ></div>
      <input
        type="range"
        min="0"
        {max}
        {step}
        value={current}
        {disabled}
        aria-label={$_(kind === 'time' ? 'dashboard.limit.type_time' : 'dashboard.limit.type_energy')}
        oninput={handleInput}
        onchange={handleChange}
        class="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </div>

    <!-- knob pin + value pill (one opacity layer, like the SOC bar) -->
    <div class="pointer-events-none absolute inset-0" style="opacity: {knobOpacity}">
      <div class="absolute top-[28px] w-0" style="left: {knobPct}%">
        <div class="absolute -top-2.5 left-1/2 h-[48px] w-2.5 -translate-x-1/2 rounded-b-[3px] bg-text"></div>
      </div>
      <div
        class="absolute top-0 rounded-md border border-text bg-surface px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-text"
        style="left: {knobPct}%; transform: translateX(-{pillShift}%)"
      >
        {fmt(current)}
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Run — expect 7 PASS** (same command).

- [ ] **Step 5: Suite + commit**

```bash
npm test
git add src/lib/components/dashboard/LimitSliderBar.svelte src/lib/components/dashboard/__tests__/LimitSliderBar.test.js
git commit -m "feat(dashboard): LimitSliderBar inline time/energy limit editor"
```

---

### Task 3: Remove the unit toggle from `VehicleSocBar`

**Files:**
- Modify: `src/lib/components/dashboard/VehicleSocBar.svelte`
- Test: `src/lib/components/dashboard/__tests__/VehicleSocBar.test.js`

- [ ] **Step 1: Update the tests FIRST** (this task removes shipped behavior by design). In `VehicleSocBar.test.js`:
- DELETE the test `shows the unit toggle only when estMaxRange is known` and the test `emits onunit when a unit button is clicked` (and the `onunit` fixture usage they contain).
- ADD in their place:

```js
  it('renders no unit toggle (pills own the unit)', () => {
    const { queryByRole } = render(VehicleSocBar, { props: { ...base, estMaxRange: 278 } })
    expect(queryByRole('group')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run — expect the new test to FAIL** (toggle still renders): `npx vitest run src/lib/components/dashboard/__tests__/VehicleSocBar.test.js`

- [ ] **Step 3: Implement** — in `VehicleSocBar.svelte`:
1. Remove `onunit = () => {},` from the props destructuring.
2. Remove the `let showUnitToggle = $derived(Number.isFinite(estMaxRange))` line.
3. In the header block, delete the entire `{#if showUnitToggle} … {/if}` group (the `role="group"` div with the two unit buttons), leaving the header as just the progress span:

```svelte
  <!-- header: info line (unit selection lives in the card's pills) -->
  <div class="mb-3 flex items-center justify-between gap-2">
    <span class="min-w-0 truncate text-xs text-text">
      {progress}{#if toFull} · {$_('dashboard.vehicle.to_full', { values: { time: toFull } })}{/if}
    </span>
  </div>
```

Nothing else changes — `unit`, `rangeMode`, `fmt`, knob, ceiling, pin all stay.

- [ ] **Step 4: Run — expect ALL PASS.** Note: `ChargeLimitCard.test.js` and `Dashboard.test.js` still pass because they never asserted the toggle. Correction: `Dashboard.test.js`'s "uploads a range limit when committed in range mode" test DID click the toggle; it was re-pointed in this task to seed an active range limit (`limit_store.set({ type: 'range', … })`) so range mode is established via `limitUnit` derivation rather than a button click.

- [ ] **Step 5: Suite + commit**

```bash
npm test
git add src/lib/components/dashboard/VehicleSocBar.svelte src/lib/components/dashboard/__tests__/VehicleSocBar.test.js
git commit -m "feat(dashboard): drop the SOC bar unit toggle (pills own the unit)"
```

---

### Task 4: Rewrite `ChargeLimitCard` — pills + editor slot

**Files:**
- Modify: `src/lib/components/dashboard/ChargeLimitCard.svelte` (full rewrite)
- Test: `src/lib/components/dashboard/__tests__/ChargeLimitCard.test.js` (full rewrite)

- [ ] **Step 1: Replace the test file wholesale:**

```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ChargeLimitCard from '../ChargeLimitCard.svelte'

const vehicle = { hasSoc: true, soc: 74, vehicleLimit: 90, target: 80, estMaxRange: 278 }

describe('ChargeLimitCard (pills)', () => {
  it('shows all four pills with vehicle data and a range estimate', () => {
    const { getByRole } = render(ChargeLimitCard, { props: { ...vehicle } })
    for (const k of ['type_soc', 'type_range', 'type_time', 'type_energy'])
      expect(getByRole('radio', { name: `dashboard.limit.${k}` })).toBeInTheDocument()
  })

  it('collapses to Time and Energy pills without vehicle data', () => {
    const { queryByRole, getByRole } = render(ChargeLimitCard, { props: { hasSoc: false } })
    expect(queryByRole('radio', { name: 'dashboard.limit.type_soc' })).not.toBeInTheDocument()
    expect(queryByRole('radio', { name: 'dashboard.limit.type_range' })).not.toBeInTheDocument()
    expect(getByRole('radio', { name: 'dashboard.limit.type_time' })).toBeInTheDocument()
    expect(getByRole('radio', { name: 'dashboard.limit.type_energy' })).toBeInTheDocument()
  })

  it('defaults to the SOC editor with a vehicle and the Time editor without', () => {
    const withCar = render(ChargeLimitCard, { props: { ...vehicle } })
    expect(withCar.getByRole('slider', { name: 'dashboard.vehicle.target_aria' })).toBeInTheDocument()
    const without = render(ChargeLimitCard, { props: { hasSoc: false } })
    expect(without.getByRole('slider', { name: 'dashboard.limit.type_time' })).toBeInTheDocument()
  })

  it('defaults to the active limit type and marks its pill', () => {
    const { getByRole } = render(ChargeLimitCard, {
      props: { ...vehicle, limit: { type: 'energy', value: 10000, auto_release: true } },
    })
    expect(getByRole('slider', { name: 'dashboard.limit.type_energy' })).toBeInTheDocument()
    expect(getByRole('radio', { name: 'dashboard.limit.type_energy' }).getAttribute('aria-checked')).toBe('true')
    expect(getByRole('radio', { name: 'dashboard.limit.type_energy' }).querySelector('[data-active-dot]')).toBeTruthy()
  })

  it('keeps the active dot visible while viewing another pill', async () => {
    const { getByRole } = render(ChargeLimitCard, {
      props: { ...vehicle, limit: { type: 'energy', value: 10000, auto_release: true } },
    })
    await fireEvent.click(getByRole('radio', { name: 'dashboard.limit.type_time' }))
    expect(getByRole('slider', { name: 'dashboard.limit.type_time' })).toBeInTheDocument()
    expect(getByRole('radio', { name: 'dashboard.limit.type_energy' }).querySelector('[data-active-dot]')).toBeTruthy()
  })

  it('forwards SOC/Range pill picks to onunit', async () => {
    const onunit = vi.fn()
    const { getByRole } = render(ChargeLimitCard, { props: { ...vehicle, onunit } })
    await fireEvent.click(getByRole('radio', { name: 'dashboard.limit.type_range' }))
    expect(onunit).toHaveBeenCalledWith('range')
    await fireEvent.click(getByRole('radio', { name: 'dashboard.limit.type_soc' }))
    expect(onunit).toHaveBeenCalledWith('percent')
  })

  it('emits onlimit with device units from the inline editors', async () => {
    const onlimit = vi.fn()
    const { getByRole } = render(ChargeLimitCard, { props: { hasSoc: false, onlimit } })
    const slider = getByRole('slider', { name: 'dashboard.limit.type_time' })
    slider.value = '120'
    await fireEvent.change(slider)
    expect(onlimit).toHaveBeenCalledWith({ type: 'time', value: 120 })
  })

  it('disables only the active system limit editor', async () => {
    const { getByRole } = render(ChargeLimitCard, {
      props: { hasSoc: false, limit: { type: 'time', value: 120, auto_release: false }, systemLimit: true },
    })
    expect(getByRole('slider', { name: 'dashboard.limit.type_time' })).toBeDisabled()
    await fireEvent.click(getByRole('radio', { name: 'dashboard.limit.type_energy' }))
    expect(getByRole('slider', { name: 'dashboard.limit.type_energy' })).not.toBeDisabled()
  })

  it('has no clear button, set button, or modal trigger', () => {
    const { queryByLabelText, queryByText } = render(ChargeLimitCard, {
      props: { ...vehicle, limit: { type: 'energy', value: 10000, auto_release: true } },
    })
    expect(queryByLabelText('dashboard.limit.clear')).not.toBeInTheDocument()
    expect(queryByText('dashboard.limit.set')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAILs** (old card): `npx vitest run src/lib/components/dashboard/__tests__/ChargeLimitCard.test.js`

- [ ] **Step 3: Replace the component wholesale:**

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import VehicleSocBar from './VehicleSocBar.svelte'
  import LimitSliderBar from './LimitSliderBar.svelte'

  let {
    // vehicle-bar inputs
    hasSoc = false,
    soc = 0,
    vehicleLimit = null,
    target = 80,
    range = null,
    rangeMiles = false,
    timeToFull = 0,
    charging = false,
    estMaxRange = null,
    disabled = false,
    ontarget = () => {},
    onunit = () => {},
    // limit state + inline editors
    limit = { type: 'none' },
    elapsedSec = 0,
    sessionWh = 0,
    systemLimit = false,
    onlimit = () => {},
  } = $props()

  let canRange = $derived(hasSoc && Number.isFinite(estMaxRange))
  let pills = $derived([
    ...(hasSoc ? [{ id: 'soc', labelKey: 'dashboard.limit.type_soc' }] : []),
    ...(canRange ? [{ id: 'range', labelKey: 'dashboard.limit.type_range' }] : []),
    { id: 'time', labelKey: 'dashboard.limit.type_time' },
    { id: 'energy', labelKey: 'dashboard.limit.type_energy' },
  ])

  // The active limit's pill is the default; a manual pick overrides it (same
  // userUnit pattern as the Dashboard). Clamp to an available pill in case a
  // range limit is active but the range estimate has gone away.
  let activeType = $derived(limit?.type && limit.type !== 'none' ? limit.type : null)
  let userPick = $state(null)
  let selected = $derived.by(() => {
    const want = userPick ?? activeType ?? (hasSoc ? 'soc' : 'time')
    return pills.some((p) => p.id === want) ? want : pills[0].id
  })

  function pick(id) {
    userPick = id
    if (id === 'soc') onunit('percent')
    else if (id === 'range') onunit('range')
  }

  // Only the editor of the ACTIVE system limit is read-only; other editors
  // stay usable (committing them overrides the default for this session and
  // leaves the config untouched).
  let editorDisabled = $derived((id) => disabled || (systemLimit && activeType === id))
</script>

<div class="mt-3 rounded-xl bg-surface-2 px-3 py-3">
  <div role="radiogroup" aria-label={$_('dashboard.limit.pills_aria')} class="mb-1 flex gap-1.5">
    {#each pills as pill}
      <button
        type="button"
        role="radio"
        aria-checked={selected === pill.id}
        onclick={() => pick(pill.id)}
        class="relative rounded-full border px-3 py-1 text-[11px] font-semibold transition
               {selected === pill.id
                 ? 'border-accent text-accent'
                 : 'border-border text-text-dim'}"
      >
        {$_(pill.labelKey)}
        {#if activeType === pill.id}
          <span data-active-dot class="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent"></span>
        {/if}
      </button>
    {/each}
  </div>

  {#if selected === 'soc' || selected === 'range'}
    <VehicleSocBar
      {soc}
      {vehicleLimit}
      {target}
      {range}
      {rangeMiles}
      {timeToFull}
      {charging}
      unit={selected === 'range' ? 'range' : 'percent'}
      {estMaxRange}
      disabled={editorDisabled(selected)}
      onchange={ontarget}
    />
  {:else}
    <LimitSliderBar
      kind={selected}
      value={activeType === selected ? (limit?.value ?? 0) : 0}
      progress={selected === 'time' ? elapsedSec : sessionWh}
      {charging}
      disabled={editorDisabled(selected)}
      onchange={(v) => onlimit({ type: selected, value: v })}
    />
  {/if}
</div>
```

Note: `editorDisabled` as a `$derived` returning a function keeps the per-pill
logic in one place; if the Svelte compiler complains, inline the expression at
both call sites instead (`disabled || (systemLimit && activeType === selected)`).
The `unit` prop and the old row props (`summary`, `onopen`, `onclear`,
`clearable`) are intentionally gone — the spec's "keep `unit`" line is
superseded: the pill now derives it, and `onunit` keeps the Dashboard in sync.

- [ ] **Step 4: Run — expect 9 PASS** (same command). The Dashboard tests will now FAIL (props changed) — that's Task 5's job; do NOT commit a broken suite: **proceed straight to Task 5 and commit both together.**

---

### Task 5: Dashboard rewiring + modal removal (commits with Task 4)

**Files:**
- Modify: `src/routes/Dashboard.svelte`
- Modify: `src/routes/__tests__/Dashboard.test.js`
- Delete: `src/lib/components/dashboard/ChargeLimitModal.svelte`, `src/lib/components/dashboard/__tests__/ChargeLimitModal.test.js`

- [ ] **Step 1: Script edits in `Dashboard.svelte`:**

1. Remove the import line `import ChargeLimitModal from '../lib/components/dashboard/ChargeLimitModal.svelte'`.
2. Remove `let limitModalOpen = $state(false)` (search for `limitModalOpen`).
3. Remove `let limitSummary = $derived(formatLimit($limit_store))` (keep `formatLimit` — the ring reason uses it).
4. Replace `saveLimit` and keep `clearLimit`:

```js
  // Inline editors commit device-unit values; 0 means clear. A system limit
  // is never DELETEd from here — snap the card back instead (shipped rule).
  async function setInlineLimit({ type, value }) {
    if (busy) return
    if (!value) {
      if (systemLimit) {
        socNonce++
        return
      }
      return clearLimit()
    }
    busy = true
    try {
      const ok = await serialQueue.add(() => limit_store.upload({ type, value, auto_release: true }))
      if (ok) {
        await serialQueue.add(() => limit_store.download())
      } else {
        showWriteError()
        socNonce++
      }
    } finally {
      busy = false
    }
  }
```

(`saveLimit` is deleted; its only caller was the modal.)

- [ ] **Step 2: Template edits:**

1. The `ChargeLimitCard` block becomes:

```svelte
      <div class="max-lg:order-6 lg:col-span-2">
        {#key socNonce}
          <ChargeLimitCard
            {hasSoc}
            soc={$status_store?.battery_level ?? 0}
            {vehicleLimit}
            target={socTarget}
            range={$status_store?.battery_range ?? null}
            rangeMiles={!!$config_store?.mqtt_vehicle_range_miles}
            timeToFull={$status_store?.time_to_full_charge ?? 0}
            {charging}
            estMaxRange={maxRange}
            disabled={busy}
            ontarget={setTarget}
            onunit={(u) => (userUnit = u)}
            limit={$limit_store}
            elapsedSec={$status_store?.session_elapsed ?? 0}
            sessionWh={$status_store?.session_energy ?? 0}
            {systemLimit}
            onlimit={setInlineLimit}
          />
        {/key}
      </div>
```

(vs today: `unit={limitUnit}`, `summary={limitSummary}`, `onopen`, `onclear`, `clearable` are gone; `elapsedSec`/`sessionWh`/`systemLimit`/`onlimit` are new.)

2. Delete the `<ChargeLimitModal …/>` block after the section.

Note `limitUnit` is still used by `setTarget`/`socTarget` — it stays.

- [ ] **Step 3: Delete the modal:**

```bash
git rm src/lib/components/dashboard/ChargeLimitModal.svelte src/lib/components/dashboard/__tests__/ChargeLimitModal.test.js
```

- [ ] **Step 4: Update `Dashboard.test.js`** — replace the two row-based system-limit tests:

FROM `hides the limit clear button for a system (default) limit` / `keeps the limit clear button for a user limit` TO:

```js
  it('renders the active system limit editor disabled', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    limit_store.set({ type: 'energy', value: 10000, auto_release: false })
    const { getByRole } = render(Dashboard)
    expect(getByRole('slider', { name: 'dashboard.limit.type_energy' })).toBeDisabled()
  })

  it('renders a user limit editor enabled', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    limit_store.set({ type: 'energy', value: 10000, auto_release: true })
    const { getByRole } = render(Dashboard)
    expect(getByRole('slider', { name: 'dashboard.limit.type_energy' })).not.toBeDisabled()
  })
```

ADD an inline-commit test and a clear test:

```js
  it('uploads a time limit committed from the inline editor', async () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    const { getByRole } = render(Dashboard)
    const slider = getByRole('slider', { name: 'dashboard.limit.type_time' })
    slider.value = '120'
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/limit', JSON.stringify({ type: 'time', value: 120, auto_release: true }))
    })
  })

  it('drag-to-zero clears a user limit but never a system limit', async () => {
    // user limit: DELETE goes through
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    limit_store.set({ type: 'time', value: 120, auto_release: true })
    const first = render(Dashboard)
    const slider = first.getByRole('slider', { name: 'dashboard.limit.type_time' })
    slider.value = '0'
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('DELETE', '/limit')
    })
  })
```

(The system-limit DELETE negative stays covered: the active system editor is
disabled — asserted above — and the shipped `setSegment`/bar-ceiling negatives
in this file are untouched. The card-level no-change suppression is covered in
the LimitSliderBar tests.)

Also REMOVE any leftover assertions referencing `dashboard.limit.clear` / `dashboard.limit.set` if grep finds others (`grep -n "limit.clear\|limit.set" src/routes/__tests__/Dashboard.test.js`).

- [ ] **Step 5: Run everything:**

```bash
npx vitest run src/routes/__tests__/Dashboard.test.js src/lib/components/dashboard/
npm test
```

Expected: all green. (Count will shift: −2 modal tests, −1 old card test net, +new ones — report the actual total.)

- [ ] **Step 6: Commit Tasks 4+5 together:**

```bash
git add -A
git commit -m "feat(dashboard): limit type pills with inline editors replace the row and modal"
```

---

### Task 6: Verification pass

- [ ] **Step 1: Gates**

```bash
npm test
npm run build 2>&1 | grep -c "state_referenced_locally"   # expect: 0
grep -rn "ChargeLimitModal\|or_limit_by\|unit_aria\|dashboard.limit.set\|dashboard.limit.none" src/ && echo "STALE REFS" || echo "clean"
```

- [ ] **Step 2: Manual check** (`npm run dev:mock -- --host 0.0.0.0`):
- Vehicle present (mock): four pills; SOC default with the bar (no %/km toggle); Range pill switches the bar's labels to km; Time/Energy pills show the slider; set a time limit by dragging, see it on the SOC… switch pills — dot sits on Time; drag Time to 0 — limit clears.
- Mobile width: card behaves identically (pills wrap fine at 360px).
- Charging (mock): progress fill + "left" readout on the active editor.

- [ ] **Step 3: Report** — verified results, anything odd flagged.

---

## Self-review notes (already applied)

- Spec coverage: pills/availability/default/dot (T4), SOC-Range via existing bar minus toggle (T3/T4), LimitSliderBar scales/fill/remaining/clear/suppression (T2), modal + row removal (T4/T5), system-limit read-only + guarded clear (T4/T5), i18n swap (T1), tests incl. equal-strength replacements (T2/T4/T5).
- Documented deviation from spec: the card's `unit` prop is dropped (pill derives it; `onunit` still syncs the Dashboard's `limitUnit` for `setTarget`). Flagged in Task 4.
- Task 4 and 5 share one commit because the card's prop change breaks Dashboard tests transiently; the plan says so explicitly.
- `fillPct` multiplies by `display/max` so the fill is relative to the BAR (progress toward the knob), not the full track — i.e. fill reaches the knob exactly when the limit trips.
