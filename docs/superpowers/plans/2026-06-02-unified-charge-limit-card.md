# Unified Charge-Limit Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the vehicle SOC bar and the standalone Charge-limit card into one card: a unit-aware bar (% / range toggle) that drag-sets SOC or range limits, plus the existing compact row → modal (Time + Energy only).

**Architecture:** The bar stays percent-positioned internally; "range" mode only relabels values (km = `pct × estMaxRange/100`) and writes a `range` limit instead of `soc`. `ChargeLimitCard` is rewritten into the card container that composes `VehicleSocBar` (now unit-aware, chrome removed) + the compact limit row. The modal drops Range. The device's single-`/limit` contract is unchanged.

**Tech Stack:** Svelte 5 (runes), Tailwind 4, Vitest + @testing-library/svelte, svelte-i18n.

**Design spec:** `docs/superpowers/specs/2026-06-02-unified-charge-limit-card-design.md`

**Conventions (read once):**
- Tests in `__tests__/` next to code; component tests mock svelte-i18n so `$_('a.b.c')` returns the literal key.
- Run one file: `npx vitest run <path>`. Full suite: `npm test`. Build: `npm run build`.
- Commit per task; end every message with:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- Svelte 5 runes only.

**Key facts about the current code:**
- `soc.js` exports `socCeiling`, `isCapped`, `effectiveStop`, `socBarSegments` ({fillPct, zoneEndPct}), `hmsShort` — all percent-based.
- `VehicleSocBar.svelte` currently wraps itself in card chrome and labels everything in `%` via three i18n keys that bake in `%`: `dashboard.vehicle.charging_to` ("charging to {pct}%"), `vehicle_limit` ("vehicle limit {pct}%"), `evse_limit` ("EVSE limit {pct}%").
- `ChargeLimitCard.svelte` is currently the compact row (props `limit`, `summary`, `onopen`, `onclear`).
- `ChargeLimitModal.svelte` has type options time/energy/range.
- `Dashboard.svelte` renders `<VehicleSocBar>` (gated `hasSoc`) and `<ChargeLimitCard>` (gated `!socLimitActive`) separately, with `setSocTarget`, `socTarget`, `socLimitActive`, `socNonce`, `saveLimit`, `clearLimit`, `limitSummary`.

---

### Task 1: `estMaxRange` helper in `soc.js`

**Files:**
- Modify: `src/lib/dashboard/soc.js`
- Test: `src/lib/dashboard/__tests__/soc.test.js`

- [ ] **Step 1: Add the failing test**

In `src/lib/dashboard/__tests__/soc.test.js`, add this describe block (and add `estMaxRange` to the existing import line `import { socCeiling, isCapped, effectiveStop, socBarSegments, hmsShort } from '../soc.js'`):

```js
import { socCeiling, isCapped, effectiveStop, socBarSegments, hmsShort, estMaxRange } from '../soc.js'

describe('estMaxRange', () => {
  it('estimates the pack max range from current range and SOC', () => {
    expect(estMaxRange(206, 74)).toBeCloseTo(278.378, 2)
  })
  it('returns null when SOC is zero or range/SOC is missing', () => {
    expect(estMaxRange(206, 0)).toBe(null)
    expect(estMaxRange(null, 74)).toBe(null)
    expect(estMaxRange(206, null)).toBe(null)
    expect(estMaxRange(NaN, 74)).toBe(null)
  })
})
```
(Replace the existing `import { ... } from '../soc.js'` line with the one above.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/dashboard/__tests__/soc.test.js`
Expected: FAIL — `estMaxRange` is not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/dashboard/soc.js`:

```js
/** Estimated pack max range from a current range reading and SOC %. null if not derivable. */
export function estMaxRange(batteryRange, soc) {
  if (!Number.isFinite(batteryRange) || !Number.isFinite(soc) || soc <= 0) return null
  return batteryRange / (soc / 100)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/dashboard/__tests__/soc.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard/soc.js src/lib/dashboard/__tests__/soc.test.js
git commit -m "feat(soc): estMaxRange helper for the range-unit bar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: i18n — unit-agnostic labels + new keys

**Files:**
- Modify: `src/lib/i18n/en.json`, `es.json`, `fr.json`, `hu.json`

**Context:** The bar will format its own value (with `%` or the range unit), so the three label strings must stop baking in `%` and instead take a pre-formatted `{value}`. Also add `dashboard.limit.or_limit_by` and `dashboard.vehicle.unit_aria`. (The `type_range` key is removed later in Task 4 when the modal drops Range.)

- [ ] **Step 1: en.json**

In `dashboard.vehicle`, change three values:
- `"charging_to": "charging to {pct}%"` → `"charging_to": "to {value}"`
- `"vehicle_limit": "vehicle limit {pct}%"` → `"vehicle_limit": "vehicle limit {value}"`
- `"evse_limit": "EVSE limit {pct}%"` → `"evse_limit": "EVSE limit {value}"`

Add to `dashboard.vehicle`: `"unit_aria": "Limit units"`.
Add to `dashboard.limit`: `"or_limit_by": "Or limit by"`.

- [ ] **Step 2: es.json**
- `charging_to` → `"a {value}"`
- `vehicle_limit` → `"límite del vehículo {value}"`
- `evse_limit` → `"límite EVSE {value}"`
- `dashboard.vehicle.unit_aria` → `"Unidades del límite"`
- `dashboard.limit.or_limit_by` → `"O limitar por"`

- [ ] **Step 3: fr.json**
- `charging_to` → `"jusqu'à {value}"`
- `vehicle_limit` → `"limite du véhicule {value}"`
- `evse_limit` → `"limite EVSE {value}"`
- `dashboard.vehicle.unit_aria` → `"Unités de limite"`
- `dashboard.limit.or_limit_by` → `"Ou limiter par"`

- [ ] **Step 4: hu.json**
- `charging_to` → `"eddig: {value}"`
- `vehicle_limit` → `"jármű korlátja {value}"`
- `evse_limit` → `"EVSE korlát {value}"`
- `dashboard.vehicle.unit_aria` → `"Korlát mértékegysége"`
- `dashboard.limit.or_limit_by` → `"Vagy korlátozás eszerint"`

- [ ] **Step 5: Verify JSON + suite**

Run: `node -e "['en','es','fr','hu'].forEach(l=>JSON.parse(require('fs').readFileSync('src/lib/i18n/'+l+'.json','utf8')))" && echo OK`
Expected: `OK`

Run: `npm test`
Expected: full suite green (label key text changed, but component tests match keys not values, so no break).

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n/*.json
git commit -m "i18n: unit-agnostic bar labels ({value}) + or_limit_by + unit_aria

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Make `VehicleSocBar` unit-aware (and drop its card chrome)

**Files:**
- Modify (full rewrite): `src/lib/components/dashboard/VehicleSocBar.svelte`
- Test: `src/lib/components/dashboard/__tests__/VehicleSocBar.test.js`

**Context:** The bar keeps percent geometry; new props `unit` (`'percent'|'range'`) and `estMaxRange` drive a `fmt(pct)` that renders `%` or range. A `% / unit` toggle appears in the header only when `estMaxRange` is finite, emitting `onunit(unit)`. The outer card chrome is removed (the container provides it). `onchange` still emits the target **percent**.

- [ ] **Step 1: Update/extend the test**

Replace `src/lib/components/dashboard/__tests__/VehicleSocBar.test.js` with:

```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import VehicleSocBar from '../VehicleSocBar.svelte'

const base = { soc: 74, vehicleLimit: 90, target: 80, charging: true }

describe('VehicleSocBar', () => {
  it('shows the current SOC as a percent in percent mode', () => {
    const { getByText } = render(VehicleSocBar, { props: { ...base } })
    expect(getByText('74%')).toBeInTheDocument()
  })

  it('emits onchange with the committed percent on change', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(VehicleSocBar, { props: { ...base, onchange } })
    const input = getByRole('slider')
    input.value = '65'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(65)
  })

  it('labels the SOC in range units when in range mode', () => {
    // estMaxRange 278: fmt(soc=74) = round(74/100*278) = 206
    const { getByText } = render(VehicleSocBar, {
      props: { ...base, unit: 'range', estMaxRange: 278 },
    })
    expect(getByText('206 units.km')).toBeInTheDocument()
  })

  it('shows the unit toggle only when estMaxRange is known', () => {
    const withRange = render(VehicleSocBar, { props: { ...base, estMaxRange: 278 } })
    expect(withRange.getByLabelText('dashboard.vehicle.unit_aria')).toBeInTheDocument()
    cleanup()
    const noRange = render(VehicleSocBar, { props: { ...base } })
    expect(noRange.queryByLabelText('dashboard.vehicle.unit_aria')).not.toBeInTheDocument()
  })

  it('emits onunit when a unit button is clicked', async () => {
    const onunit = vi.fn()
    const { getAllByLabelText } = render(VehicleSocBar, {
      props: { ...base, estMaxRange: 278, onunit },
    })
    const buttons = getAllByLabelText('dashboard.vehicle.unit_aria')
    await fireEvent.click(buttons[1]) // the range-unit button
    expect(onunit).toHaveBeenCalledWith('range')
  })

  it('colours the EVSE-limit marker red only when above the vehicle limit', () => {
    const above = render(VehicleSocBar, { props: { soc: 74, vehicleLimit: 75, target: 80 } })
    expect(above.getByText('dashboard.vehicle.evse_limit').className).toContain('text-error')
    cleanup()
    const below = render(VehicleSocBar, { props: { soc: 74, vehicleLimit: 90, target: 80 } })
    expect(below.getByText('dashboard.vehicle.evse_limit').className).not.toContain('text-error')
  })

  it('snaps the knob back to the vehicle limit when released above it', async () => {
    const { getByRole } = render(VehicleSocBar, { props: { soc: 40, vehicleLimit: 75, target: 75 } })
    const input = getByRole('slider')
    input.value = '88'
    await fireEvent.input(input)
    await fireEvent.change(input)
    expect(input.value).toBe('75')
  })

  it('omits the vehicle-limit marker when the limit is unknown', () => {
    const { queryByText } = render(VehicleSocBar, { props: { soc: 74, vehicleLimit: null, target: 80 } })
    expect(queryByText('dashboard.vehicle.vehicle_limit')).not.toBeInTheDocument()
  })
})
```

Note: the i18n mock returns the key, so `units.km` renders literally; `fmt` produces `"206 units.km"` in the test. That's expected.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/components/dashboard/__tests__/VehicleSocBar.test.js`
Expected: FAIL (range-mode label, unit-toggle, onunit tests fail on the current component).

- [ ] **Step 3: Rewrite the component**

Replace `src/lib/components/dashboard/VehicleSocBar.svelte` entirely with:

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import { socBarSegments, isCapped, socCeiling, hmsShort } from '../../dashboard/soc.js'

  let {
    soc = 0,
    vehicleLimit = null,
    target = 80,
    range = null,
    rangeMiles = false,
    timeToFull = 0,
    charging = false,
    disabled = false,
    unit = 'percent',
    estMaxRange = null,
    onchange = () => {},
    onunit = () => {},
  } = $props()

  // Live knob position during a drag (percent). Initialise from the prop so the
  // first paint is correct; the $effect re-syncs on later prop changes, including
  // the snap back to the ceiling after the limit is cleared.
  // svelte-ignore state_referenced_locally
  let current = $state(target)
  $effect(() => {
    current = target
  })

  function handleInput(e) {
    current = Number(e.currentTarget.value)
  }
  function handleChange(e) {
    const v = Number(e.currentTarget.value)
    if (v >= ceiling) current = ceiling // at/above the vehicle limit = no limit
    onchange(v)
  }

  let seg = $derived(socBarSegments({ soc, target: current, vehicleLimit }))
  let ceiling = $derived(socCeiling(vehicleLimit))
  let above = $derived(isCapped(current, vehicleLimit))
  let atRest = $derived(current >= ceiling)
  let toFull = $derived(charging ? hmsShort(timeToFull) : '')
  let rangeUnitLabel = $derived(rangeMiles ? $_('units.miles') : $_('units.km'))
  let showUnitToggle = $derived(Number.isFinite(estMaxRange))
  let rangeMode = $derived(unit === 'range' && Number.isFinite(estMaxRange))

  // Format a bar percentage in the active unit: "60%" or "167 km".
  function fmt(pct) {
    if (rangeMode) return `${Math.round((pct / 100) * estMaxRange)} ${rangeUnitLabel}`
    return `${Math.round(pct)}%`
  }

  let lineClass = $derived(above ? 'bg-error' : 'bg-text')
  let labelClass = $derived(above ? 'border-error text-error' : 'border-border text-text')
  let knobOpacity = $derived(atRest && !above ? 0.55 : 1)
</script>

<div>
  <!-- header: info line + (when range known) the % / unit toggle -->
  <div class="mb-3 flex items-center justify-between gap-2">
    <span class="min-w-0 truncate text-xs text-text">
      {#if range != null}{range}&nbsp;{rangeUnitLabel} · {/if}{$_('dashboard.vehicle.charging_to', {
        values: { value: fmt(seg.zoneEndPct) },
      })}{#if toFull} · {$_('dashboard.vehicle.to_full', { values: { time: toFull } })}{/if}
    </span>
    {#if showUnitToggle}
      <div class="flex shrink-0 overflow-hidden rounded-full border border-border text-[10px] font-bold">
        <button
          type="button"
          aria-label={$_('dashboard.vehicle.unit_aria')}
          onclick={() => onunit('percent')}
          class="px-2 py-0.5 {unit === 'percent' ? 'bg-accent text-surface' : 'text-text-dim'}"
        >%</button>
        <button
          type="button"
          aria-label={$_('dashboard.vehicle.unit_aria')}
          onclick={() => onunit('range')}
          class="px-2 py-0.5 {unit === 'range' ? 'bg-accent text-surface' : 'text-text-dim'}"
        >{rangeUnitLabel}</button>
      </div>
    {/if}
  </div>

  <!-- bar block — percent geometry; labels via fmt() -->
  <div class="relative h-[84px]">
    <div class="absolute inset-x-0 top-[28px] h-[34px]">
      <div class="absolute inset-0 rounded-full bg-surface-3"></div>
      <div
        class="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-accent to-cyan-400"
        style="width: {seg.fillPct}%"
      ></div>
      {#if seg.zoneEndPct > seg.fillPct}
        <div
          class="absolute inset-y-0 bg-accent/30"
          style="left: {seg.fillPct}%; width: {seg.zoneEndPct - seg.fillPct}%"
        ></div>
      {/if}
      <div class="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] font-bold text-[#04121d]">
        {fmt(soc)}
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={current}
        {disabled}
        aria-label={$_('dashboard.vehicle.target_aria')}
        oninput={handleInput}
        onchange={handleChange}
        class="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </div>

    {#if vehicleLimit != null}
      <div class="pointer-events-none absolute top-[28px] w-0" style="left: {vehicleLimit}%">
        <div class="absolute top-0 left-1/2 h-[34px] w-0.5 -translate-x-1/2 bg-amber-400"></div>
      </div>
      <div
        class="pointer-events-none absolute top-[66px] whitespace-nowrap text-[10px] font-semibold text-amber-400"
        style="left: {vehicleLimit}%; transform: translateX(-{vehicleLimit}%)"
      >
        {$_('dashboard.vehicle.vehicle_limit', { values: { value: fmt(vehicleLimit) } })}
      </div>
    {/if}

    <div
      class="pointer-events-none absolute top-0 whitespace-nowrap rounded-md border bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold {labelClass}"
      style="left: {current}%; transform: translateX(-{current}%); opacity: {knobOpacity}"
    >
      {$_('dashboard.vehicle.evse_limit', { values: { value: fmt(current) } })}
    </div>
    <div class="pointer-events-none absolute top-[28px] w-0" style="left: {current}%; opacity: {knobOpacity}">
      <div class="absolute top-0 left-1/2 h-[34px] w-1.5 -translate-x-1/2 rounded-[3px] {lineClass}"></div>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/components/dashboard/__tests__/VehicleSocBar.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/dashboard/VehicleSocBar.svelte src/lib/components/dashboard/__tests__/VehicleSocBar.test.js
git commit -m "feat(soc): unit-aware bar (% / range toggle); drop own card chrome

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Drop Range from `ChargeLimitModal` (and the orphaned key)

**Files:**
- Modify: `src/lib/components/dashboard/ChargeLimitModal.svelte`
- Modify: `src/lib/i18n/en.json`, `es.json`, `fr.json`, `hu.json` (remove `dashboard.limit.type_range`)
- Test (verify): `src/lib/components/dashboard/__tests__/ChargeLimitModal.test.js`

**Context:** Range now lives on the bar, so the modal keeps only Time + Energy. READ the current `ChargeLimitModal.svelte` first.

- [ ] **Step 1: Remove the range option/branch/state/prop**

In `src/lib/components/dashboard/ChargeLimitModal.svelte`:
- Change the props line `let { open = false, allowRange = false, onclose = () => {}, onsave = () => {} } = $props()` to `let { open = false, onclose = () => {}, onsave = () => {} } = $props()`.
- Delete the `let rangeKm = $state(200)` line and the `rangeKm = 200` line inside the `$effect` reset.
- Remove the range entry from `typeOptions`:
  ```js
  { value: 'range', label: $_('dashboard.limit.type_range'), disabled: !allowRange },
  ```
- Remove the range render branch:
  ```svelte
  {:else if type === 'range'}
    <div class="mb-1 text-sm text-text">{rangeKm} km</div>
    <Slider min={10} max={600} step={10} value={rangeKm} onchange={(v) => (rangeKm = v)} />
  ```
- Remove the range branch from `save()`: `else if (type === 'range') value = rangeKm`.

- [ ] **Step 2: Remove the orphaned `type_range` i18n key**

Confirm it is unused: `grep -rn "type_range" src --include=*.svelte --include=*.js` → should return nothing after Step 1. Then remove the `"type_range": "..."` line from `dashboard.limit` in all four locale files (`en/es/fr/hu`).

- [ ] **Step 3: Verify**

Run: `grep -rn "range\|allowRange" src/lib/components/dashboard/ChargeLimitModal.svelte` → expect no matches.
Run: `node -e "['en','es','fr','hu'].forEach(l=>JSON.parse(require('fs').readFileSync('src/lib/i18n/'+l+'.json','utf8')))" && echo OK` → `OK`.
Run: `npx vitest run src/lib/components/dashboard/__tests__/ChargeLimitModal.test.js`
Expected: PASS (3 tests — energy default, reset, closed renders nothing).

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/dashboard/ChargeLimitModal.svelte src/lib/i18n/*.json
git commit -m "refactor(limit): drop Range from modal (now on the bar); remove type_range key

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Rewrite `ChargeLimitCard` into the unified container

**Files:**
- Modify (full rewrite): `src/lib/components/dashboard/ChargeLimitCard.svelte`
- Test: `src/lib/components/dashboard/__tests__/ChargeLimitCard.test.js`

**Context:** The card now owns the chrome and composes the bar (when `hasSoc`) + the compact "Or limit by" row. The row is "active" only for time/energy limits (soc/range are the bar's). It forwards bar inputs to `VehicleSocBar` and emits `onTarget`/`onunit` for the bar, `onopen`/`onclear` for the row.

- [ ] **Step 1: Replace the test**

Replace `src/lib/components/dashboard/__tests__/ChargeLimitCard.test.js` with:

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
  it('shows "none set" and calls onopen when no time/energy limit', async () => {
    const onopen = vi.fn()
    const { getByText } = render(ChargeLimitCard, {
      props: { hasSoc: false, limit: { type: 'none' }, onopen },
    })
    expect(getByText('dashboard.limit.none')).toBeInTheDocument()
    await fireEvent.click(getByText('dashboard.limit.set'))
    expect(onopen).toHaveBeenCalledOnce()
  })

  it('shows the time/energy summary and calls onclear', async () => {
    const onclear = vi.fn()
    const { getByText, getByLabelText } = render(ChargeLimitCard, {
      props: { hasSoc: false, limit: { type: 'energy', value: 10000 }, summary: '10 kWh', onclear },
    })
    expect(getByText('10 kWh')).toBeInTheDocument()
    await fireEvent.click(getByLabelText('dashboard.limit.clear'))
    expect(onclear).toHaveBeenCalledOnce()
  })

  it('does not treat a soc/range limit as an active row (bar owns it)', () => {
    const { getByText } = render(ChargeLimitCard, {
      props: { hasSoc: true, soc: 74, vehicleLimit: 90, target: 80, limit: { type: 'soc', value: 80 }, summary: '80%' },
    })
    // row shows "none set", not the soc summary
    expect(getByText('dashboard.limit.none')).toBeInTheDocument()
  })

  it('renders the bar when hasSoc', () => {
    const { getByRole } = render(ChargeLimitCard, {
      props: { hasSoc: true, soc: 74, vehicleLimit: 90, target: 80, limit: { type: 'none' } },
    })
    expect(getByRole('slider', { name: 'dashboard.vehicle.target_aria' })).toBeInTheDocument()
  })

  it('hides the bar when not hasSoc', () => {
    const { queryByRole } = render(ChargeLimitCard, {
      props: { hasSoc: false, limit: { type: 'none' } },
    })
    expect(queryByRole('slider', { name: 'dashboard.vehicle.target_aria' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/components/dashboard/__tests__/ChargeLimitCard.test.js`
Expected: FAIL (props/behavior differ from the current compact-row component).

- [ ] **Step 3: Rewrite the component**

Replace `src/lib/components/dashboard/ChargeLimitCard.svelte` entirely with:

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import Icon from '../../icons/Icon.svelte'
  import VehicleSocBar from './VehicleSocBar.svelte'

  let {
    // bar inputs
    hasSoc = false,
    soc = 0,
    vehicleLimit = null,
    target = 80,
    range = null,
    rangeMiles = false,
    timeToFull = 0,
    charging = false,
    unit = 'percent',
    estMaxRange = null,
    disabled = false,
    onTarget = () => {},
    onunit = () => {},
    // time/energy limit row
    limit = { type: 'none' },
    summary = '',
    onopen = () => {},
    onclear = () => {},
  } = $props()

  // The compact row reflects only the non-bar limit kinds (time/energy).
  let rowActive = $derived(limit && (limit.type === 'time' || limit.type === 'energy'))
  // Without a vehicle the row is the only limit control, so label it plainly.
  let rowLabelKey = $derived(hasSoc ? 'dashboard.limit.or_limit_by' : 'dashboard.limit.label')
</script>

<div class="mt-3 rounded-xl bg-surface-2 px-3 py-3">
  {#if hasSoc}
    <VehicleSocBar
      {soc}
      {vehicleLimit}
      {target}
      {range}
      {rangeMiles}
      {timeToFull}
      {charging}
      {unit}
      {estMaxRange}
      {disabled}
      onchange={onTarget}
      {onunit}
    />
    <div class="my-3 border-t border-border"></div>
  {/if}

  <div class="flex items-center justify-between">
    <div>
      <div class="text-[8px] tracking-wide text-text-dim uppercase">{$_(rowLabelKey)}</div>
      <div class="mt-0.5 text-sm font-bold text-text">
        {rowActive ? summary : $_('dashboard.limit.none')}
      </div>
    </div>
    {#if rowActive}
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
        + <span>{$_('dashboard.limit.set')}</span>
      </button>
    {/if}
  </div>
</div>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/components/dashboard/__tests__/ChargeLimitCard.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/dashboard/ChargeLimitCard.svelte src/lib/components/dashboard/__tests__/ChargeLimitCard.test.js
git commit -m "feat(limit): ChargeLimitCard becomes the unified container (bar + Time/Energy row)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Wire the unified card into `Dashboard.svelte`

**Files:**
- Modify: `src/routes/Dashboard.svelte`
- Test: `src/routes/__tests__/Dashboard.test.js`

**Context:** Dashboard now renders a single `<ChargeLimitCard>` (no separate `VehicleSocBar`). Add `maxRange` and unit state, a `barLimitActive` derived, a `setTarget` that writes `soc` or `range` by unit (with snap-to-clear), and pass everything in. The modal loses `allowRange`. READ the current `Dashboard.svelte` regions first.

- [ ] **Step 1: Update/extend the tests**

Edit `src/routes/__tests__/Dashboard.test.js`.

Replace the existing test `it('shows the vehicle SOC bar when battery_level is present', ...)` body to query the same role (unchanged), and replace the `it('uploads an soc limit when the SOC target is committed', ...)` with the two below; also add a range test. Concretely, ensure these three tests exist (replace the single upload test with them):

```js
  it('shows the charge-limit bar when battery_level is present', () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 80, battery_range: 206, time_to_full_charge: 0 })
    const { getByRole } = render(Dashboard)
    expect(getByRole('slider', { name: 'dashboard.vehicle.target_aria' })).toBeInTheDocument()
  })

  it('uploads a soc limit when the bar is committed in percent mode', async () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 90, battery_range: 206, time_to_full_charge: 0 })
    const { getByRole } = render(Dashboard)
    const slider = getByRole('slider', { name: 'dashboard.vehicle.target_aria' })
    slider.value = '85'
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/limit', JSON.stringify({ type: 'soc', value: 85, auto_release: true }))
    })
  })

  it('uploads a range limit when committed in range mode', async () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 90, battery_range: 206, time_to_full_charge: 0 })
    const { getByRole, getAllByLabelText } = render(Dashboard)
    // switch to range mode (second unit button)
    await fireEvent.click(getAllByLabelText('dashboard.vehicle.unit_aria')[1])
    const slider = getByRole('slider', { name: 'dashboard.vehicle.target_aria' })
    slider.value = '50' // 50% of estMaxRange(206/0.74=278.4) = 139 km
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/limit', JSON.stringify({ type: 'range', value: 139, auto_release: true }))
    })
  })
```

(Keep the existing "hides the SOC bar when there is no battery_level" and "clears the soc limit when the knob is dragged up to the vehicle limit" tests — they still pass against the new wiring.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/routes/__tests__/Dashboard.test.js`
Expected: FAIL (range-mode test fails; unit toggle / wiring not present yet).

- [ ] **Step 3: Update imports**

In `src/routes/Dashboard.svelte`:
- Remove `import VehicleSocBar from '../lib/components/dashboard/VehicleSocBar.svelte'`.
- Change `import { socCeiling } from '../lib/dashboard/soc.js'` to `import { socCeiling, estMaxRange } from '../lib/dashboard/soc.js'`.
- Keep the `import ChargeLimitCard ...` line.

- [ ] **Step 4: Replace the SOC view-model block**

Replace this block (currently lines ~115–126):

```js
  // ── vehicle SOC bar view-model ──────────────────────────────────────────
  let hasSoc = $derived(
    $status_store?.battery_level !== undefined && $status_store?.battery_level !== null,
  )
  let vehicleLimit = $derived(
    Number.isFinite($status_store?.vehicle_charge_limit) ? $status_store.vehicle_charge_limit : null,
  )
  let socLimitActive = $derived($limit_store?.type === 'soc')
  // Knob rests at the ceiling (vehicle limit, or 100) when no soc limit is set.
  let socTarget = $derived(socLimitActive ? $limit_store.value : socCeiling(vehicleLimit))
  // Bumped on a failed soc write to remount the bar back to the confirmed value.
  let socNonce = $state(0)
```
with:
```js
  // ── charge-limit bar view-model ─────────────────────────────────────────
  let hasSoc = $derived(
    $status_store?.battery_level !== undefined && $status_store?.battery_level !== null,
  )
  let vehicleLimit = $derived(
    Number.isFinite($status_store?.vehicle_charge_limit) ? $status_store.vehicle_charge_limit : null,
  )
  let maxRange = $derived(estMaxRange($status_store?.battery_range, $status_store?.battery_level))
  // The bar owns soc + range limits; the row owns time + energy.
  let barLimitActive = $derived($limit_store?.type === 'soc' || $limit_store?.type === 'range')
  // Display unit: follows the active range limit by default; the toggle overrides.
  let userUnit = $state(null)
  let limitUnit = $derived(userUnit ?? ($limit_store?.type === 'range' ? 'range' : 'percent'))
  // Knob position is always a percent. Map the active limit back to a percent.
  let socTarget = $derived(
    $limit_store?.type === 'soc'
      ? $limit_store.value
      : $limit_store?.type === 'range' && Number.isFinite(maxRange)
        ? ($limit_store.value / maxRange) * 100
        : socCeiling(vehicleLimit),
  )
  // Bumped on a failed bar write to remount the card back to the confirmed value.
  let socNonce = $state(0)
```

- [ ] **Step 5: Replace `setSocTarget` with `setTarget`**

Replace the whole `setSocTarget` function (the `async function setSocTarget(val) { ... }` block) with:

```js
  // Snap-to-clear: a knob at/above the vehicle limit means "no limit". Below it,
  // write a soc or range limit depending on the active display unit.
  async function setTarget(pct) {
    if (busy) return
    busy = true
    try {
      let ok
      if (pct >= socCeiling(vehicleLimit)) {
        ok = barLimitActive ? await serialQueue.add(() => limit_store.remove()) : true
      } else {
        const data =
          limitUnit === 'range' && Number.isFinite(maxRange)
            ? { type: 'range', value: Math.round((pct / 100) * maxRange), auto_release: true }
            : { type: 'soc', value: pct, auto_release: true }
        ok = await serialQueue.add(() => limit_store.upload(data))
        if (ok) await serialQueue.add(() => limit_store.download())
      }
      if (!ok) {
        showWriteError()
        socNonce++ // remount the card so the knob reverts to the confirmed value
      }
    } finally {
      busy = false
    }
  }
```

- [ ] **Step 6: Replace the markup (bar + standalone card → one card)**

Replace this fragment (currently inside `{#if display !== 'error'}`):

```svelte
    {#if hasSoc}
      {#key socNonce}
        <VehicleSocBar
          soc={$status_store.battery_level}
          {vehicleLimit}
          target={socTarget}
          range={$status_store?.battery_range ?? null}
          rangeMiles={!!$config_store?.mqtt_vehicle_range_miles}
          timeToFull={$status_store?.time_to_full_charge ?? 0}
          {charging}
          disabled={busy}
          onchange={setSocTarget}
        />
      {/key}
    {/if}

    {#if !socLimitActive}
      <ChargeLimitCard
        limit={$limit_store}
        summary={limitSummary}
        onopen={() => (limitModalOpen = true)}
        onclear={clearLimit}
      />
    {/if}
```
with:
```svelte
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
        unit={limitUnit}
        estMaxRange={maxRange}
        disabled={busy}
        onTarget={setTarget}
        onunit={(u) => (userUnit = u)}
        limit={$limit_store}
        summary={limitSummary}
        onopen={() => (limitModalOpen = true)}
        onclear={clearLimit}
      />
    {/key}
```

- [ ] **Step 7: Drop `allowRange` from the modal instance**

Change the `<ChargeLimitModal ... />` instance to remove the `allowRange` line (keep `open`, `onclose`, `onsave`):

```svelte
<ChargeLimitModal
  open={limitModalOpen}
  onclose={() => (limitModalOpen = false)}
  onsave={saveLimit}
/>
```

- [ ] **Step 8: Run the Dashboard tests**

Run: `npx vitest run src/routes/__tests__/Dashboard.test.js`
Expected: PASS — percent + range writes, clear, bar present/absent, plus existing tests.

- [ ] **Step 9: Full suite + build**

Run: `npm test` → full suite green (paste the summary).
Run: `npm run build` → clean build, no missing-i18n-key warnings, no unresolved imports (paste the build line).

- [ ] **Step 10: Commit**

```bash
git add src/routes/Dashboard.svelte src/routes/__tests__/Dashboard.test.js
git commit -m "feat(dashboard): unified charge-limit card — bar (%/range) + Time/Energy in one card

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the implementer

- **The bar is always percent internally.** `onchange`/`onTarget` emit a percent; Dashboard converts to a `range` km value (`round(pct/100 · maxRange)`) only when the unit is range and `maxRange` is finite.
- **Two sliders on the page** remain distinguishable: the bar's input is `dashboard.vehicle.target_aria`; there is no other named slider on the Dashboard now (rate lives in a popover that isn't open during these tests). Always query by name.
- **`socNonce` wraps the whole card** so a failed bar write reverts the knob (the card remounts).
- **`formatLimit`'s soc/range branches** in Dashboard are now only exercised for the (unused-by-the-row) summary; leave them — harmless.
- Do not delete `VehicleSocBar.svelte` (now a child of `ChargeLimitCard`) or rename `soc.js`.
