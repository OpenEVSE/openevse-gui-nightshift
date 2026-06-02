# Charging Session Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While charging, replace the dashboard PowerRing with a current-session combo chart — SOC bars + kW line — sourced from the `/energy/raw` log's new `s` (SOC) field.

**Architecture:** Pure, unit-tested helpers in `src/lib/dashboard/sessionChart.js` shape `/energy/raw` samples into uPlot data/opts (clip to session, derive kW = amps×voltage, gap SOC `<0`). A presentational `SessionChart.svelte` renders them through the existing `UplotChart.svelte` wrapper. A `ChargingHero.svelte` composes the status-row pills + kW/SOC readout + chart. `Dashboard.svelte` swaps PowerRing↔ChargingHero on the `charging` flag and owns the 10 s `/energy/raw` polling (gated on `charging`, so mount/unmount starts/stops it). Spec wording put polling in ChargingHero; the plan keeps it in Dashboard so ChargingHero stays a pure presentational component (easier to test, consistent with the other dashboard components).

**Tech Stack:** Svelte 5 runes, uPlot (+ existing `UplotChart.svelte` wrapper), Tailwind tokens, svelte-i18n (en/es/fr/hu), Vitest + @testing-library/svelte.

**Spec:** `docs/superpowers/specs/2026-06-02-charging-session-chart-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/dashboard/sessionChart.js` (create) | Pure helpers: clip to session, kW/SOC derivation, uPlot data + opts + limit-line plugin |
| `src/lib/dashboard/__tests__/sessionChart.test.js` (create) | Unit tests for the helpers |
| `src/lib/components/dashboard/SessionChart.svelte` (create) | Presentational combo chart; placeholder under 2 samples |
| `src/lib/components/dashboard/__tests__/SessionChart.test.js` (create) | Placeholder-branch render test |
| `src/lib/components/dashboard/ChargingHero.svelte` (create) | Charging-state hero: status-row pills + kW/SOC readout + chart |
| `src/lib/components/dashboard/__tests__/ChargingHero.test.js` (create) | Readout + status-row + chart-error render tests |
| `src/lib/i18n/{en,es,fr,hu}.json` (modify) | New `dashboard.session.*` strings |
| `src/routes/Dashboard.svelte` (modify) | Hero swap on `charging`, `/energy/raw` polling, prop wiring |

---

## Task 1: Pure helpers — clip, derive, shape

**Files:**
- Create: `src/lib/dashboard/sessionChart.js`
- Test: `src/lib/dashboard/__tests__/sessionChart.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/dashboard/__tests__/sessionChart.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  clipToSession,
  sampleKw,
  socOrNull,
  toChartData,
  kwAxisMax,
  fmtSessionTime,
} from '../sessionChart.js'

const S = (ts, a, s) => ({ ts, a, t: 0, e: 0, s })

describe('clipToSession', () => {
  it('keeps only samples within session_elapsed of the latest ts', () => {
    const samples = [S(1000, 32, 50), S(1600, 32, 55), S(2000, 32, 60)]
    // latest ts 2000, elapsed 500 -> start 1500 -> drop the 1000 sample
    expect(clipToSession(samples, 500).map((x) => x.ts)).toEqual([1600, 2000])
  })
  it('returns all samples when elapsed is missing or non-positive (fallback)', () => {
    const samples = [S(1000, 32, 50), S(2000, 32, 60)]
    expect(clipToSession(samples, 0)).toHaveLength(2)
    expect(clipToSession(samples, NaN)).toHaveLength(2)
  })
  it('returns [] for empty / non-array input', () => {
    expect(clipToSession([], 500)).toEqual([])
    expect(clipToSession(undefined, 500)).toEqual([])
  })
})

describe('sampleKw', () => {
  it('returns kW = amps * volts / 1000', () => {
    expect(sampleKw({ a: 32 }, 240)).toBeCloseTo(7.68)
  })
  it('returns null when voltage is missing or zero', () => {
    expect(sampleKw({ a: 32 }, 0)).toBeNull()
    expect(sampleKw({ a: 32 }, undefined)).toBeNull()
  })
  it('returns null when amps is not finite', () => {
    expect(sampleKw({ a: undefined }, 240)).toBeNull()
  })
})

describe('socOrNull', () => {
  it('passes through a non-negative SOC', () => {
    expect(socOrNull({ s: 74 })).toBe(74)
    expect(socOrNull({ s: 0 })).toBe(0)
  })
  it('maps the -1 no-vehicle sentinel (and any negative) to null', () => {
    expect(socOrNull({ s: -1 })).toBeNull()
    expect(socOrNull({ s: undefined })).toBeNull()
  })
})

describe('toChartData', () => {
  it('builds [relativeSeconds, soc, kw] arrays', () => {
    const samples = [S(1000, 32, 50), S(1300, 16, -1), S(1600, 32, 60)]
    const [x, soc, kw] = toChartData(samples, 240)
    expect(x).toEqual([0, 300, 600]) // seconds from first ts
    expect(soc).toEqual([50, null, 60]) // -1 -> null gap
    expect(kw[0]).toBeCloseTo(7.68)
    expect(kw[1]).toBeCloseTo(3.84)
  })
})

describe('kwAxisMax', () => {
  it('floors at 8', () => {
    expect(kwAxisMax([1, 2, 3])).toBe(8)
  })
  it('uses peak + 1 headroom, ignoring nulls, rounded up', () => {
    expect(kwAxisMax([3, null, 9.2])).toBe(11)
  })
  it('returns 8 when there are no finite values', () => {
    expect(kwAxisMax([null, null])).toBe(8)
  })
})

describe('fmtSessionTime', () => {
  it('formats seconds as minutes', () => {
    expect(fmtSessionTime(0)).toBe('0')
    expect(fmtSessionTime(1500)).toBe('25m')
  })
  it('rolls into h:mm past an hour', () => {
    expect(fmtSessionTime(3900)).toBe('1h05')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/rar/openevse-gui-nightshift && npx vitest run src/lib/dashboard/__tests__/sessionChart.test.js`
Expected: FAIL — `Failed to resolve import "../sessionChart.js"`.

- [ ] **Step 3: Write the helpers**

Create `src/lib/dashboard/sessionChart.js` (helpers only — uPlot opts come in Task 2; do NOT add the `import uPlot` line yet):

```js
// Pure transforms turning /energy/raw samples into chart-ready data.
// Sample shape: { ts:<unix s>, a:<amps>, t:<°C>, e:<energy>, s:<soc %, -1 = none> }

/** Keep only samples within `sessionElapsed` seconds of the newest sample.
 *  Falls back to all samples when elapsed is absent/0 (e.g. flaky firmware). */
export function clipToSession(samples, sessionElapsed) {
  if (!Array.isArray(samples) || samples.length === 0) return []
  if (!Number.isFinite(sessionElapsed) || sessionElapsed <= 0) return samples
  const start = samples[samples.length - 1].ts - sessionElapsed
  return samples.filter((s) => s.ts >= start)
}

/** kW for one sample = amps * volts / 1000. Null when voltage/amps unusable. */
export function sampleKw(sample, voltage) {
  if (!Number.isFinite(voltage) || voltage <= 0) return null
  if (!Number.isFinite(sample?.a)) return null
  return (sample.a * voltage) / 1000
}

/** SOC percent, or null for the -1 "no vehicle source" sentinel. */
export function socOrNull(sample) {
  return Number.isFinite(sample?.s) && sample.s >= 0 ? sample.s : null
}

/** [relativeSeconds[], soc[], kw[]] for uPlot, x measured from the first sample. */
export function toChartData(samples, voltage) {
  const x0 = samples.length ? samples[0].ts : 0
  const x = samples.map((s) => s.ts - x0)
  const soc = samples.map(socOrNull)
  const kw = samples.map((s) => sampleKw(s, voltage))
  return [x, soc, kw]
}

/** Right-axis ceiling for the kW line: peak + 1 headroom, floored at 8. */
export function kwAxisMax(kwValues) {
  const finite = (kwValues || []).filter((v) => Number.isFinite(v))
  const peak = finite.length ? Math.max(...finite) : 0
  return Math.max(8, Math.ceil(peak + 1))
}

/** Format x-axis tick (relative seconds) as "0", "25m", or "1h05". */
export function fmtSessionTime(sec) {
  const m = Math.round(sec / 60)
  if (m === 0) return '0'
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/rar/openevse-gui-nightshift && npx vitest run src/lib/dashboard/__tests__/sessionChart.test.js`
Expected: PASS (all assertions green).

- [ ] **Step 5: Commit**

```bash
cd /home/rar/openevse-gui-nightshift
git add src/lib/dashboard/sessionChart.js src/lib/dashboard/__tests__/sessionChart.test.js
git commit -m "feat: session-chart data helpers (clip, kW/SOC derivation, shaping)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: uPlot opts + dashed limit-line plugin

**Files:**
- Modify: `src/lib/dashboard/sessionChart.js`
- Test: `src/lib/dashboard/__tests__/sessionChart.test.js`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/dashboard/__tests__/sessionChart.test.js`:

```js
import { buildSessionOpts, limitLinePlugin, liveDotPlugin } from '../sessionChart.js'

const theme = { accent: '#3cc6bd', charging: '#3cc6bd', warning: '#e7a948', axisText: '#6b7585', grid: '#1c2230' }

describe('buildSessionOpts', () => {
  it('defines soc (0-100) and kw (0-kwMax) scales plus a hidden-x scale', () => {
    const o = buildSessionOpts({ theme, target: 80, kwMax: 8 })
    expect(o.scales.soc.range).toEqual([0, 100])
    expect(o.scales.kw.range).toEqual([0, 8])
    expect(o.scales.x.time).toBe(false)
  })
  it('renders SOC as bars and kW as a line series', () => {
    const o = buildSessionOpts({ theme, target: 80, kwMax: 8 })
    // [x, soc, kw]
    expect(typeof o.series[1].paths).toBe('function') // bars path builder
    expect(o.series[1].scale).toBe('soc')
    expect(o.series[2].scale).toBe('kw')
    expect(o.series[2].paths).toBeUndefined() // default line
  })
  it('includes the limit-line and live-dot plugins', () => {
    const o = buildSessionOpts({ theme, target: 80, kwMax: 8 })
    expect(o.plugins).toHaveLength(2)
    expect(typeof o.plugins[0].hooks.draw).toBe('function')
    expect(typeof o.plugins[1].hooks.draw).toBe('function')
  })
})

describe('limitLinePlugin', () => {
  it('no-ops in draw when target is not finite', () => {
    const p = limitLinePlugin(null, '#e7a948')
    // a fake uPlot whose ctx would throw if touched
    const u = { valToPos: () => { throw new Error('should not be called') }, ctx: {}, bbox: {} }
    expect(() => p.hooks.draw(u)).not.toThrow()
  })
})

describe('liveDotPlugin', () => {
  it('no-ops in draw when there is no finite kW point', () => {
    const p = liveDotPlugin('#e7a948')
    const u = { data: [[], [], []], valToPos: () => { throw new Error('should not be called') }, ctx: {} }
    expect(() => p.hooks.draw(u)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/rar/openevse-gui-nightshift && npx vitest run src/lib/dashboard/__tests__/sessionChart.test.js`
Expected: FAIL — `buildSessionOpts is not a function` / `limitLinePlugin is not a function` / `liveDotPlugin is not a function`.

- [ ] **Step 3: Implement the opts builder + plugin**

Add the uPlot import at the TOP of `src/lib/dashboard/sessionChart.js`:

```js
import uPlot from 'uplot'
```

Append to the same file:

```js
/** uPlot plugin: a dashed horizontal line at the target SOC on the soc scale. */
export function limitLinePlugin(target, color) {
  return {
    hooks: {
      draw: (u) => {
        if (!Number.isFinite(target)) return
        const y = u.valToPos(target, 'soc', true)
        const { ctx } = u
        ctx.save()
        ctx.strokeStyle = color
        ctx.setLineDash([3, 3])
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(u.bbox.left, y)
        ctx.lineTo(u.bbox.left + u.bbox.width, y)
        ctx.stroke()
        ctx.restore()
      },
    },
  }
}

/** uPlot plugin: a static amber "you are here" dot at the latest finite kW point. */
export function liveDotPlugin(color) {
  return {
    hooks: {
      draw: (u) => {
        const xs = u.data[0]
        const kw = u.data[2]
        let i = kw.length - 1
        while (i >= 0 && !Number.isFinite(kw[i])) i--
        if (i < 0) return
        const cx = u.valToPos(xs[i], 'x', true)
        const cy = u.valToPos(kw[i], 'kw', true)
        const { ctx } = u
        ctx.save()
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      },
    },
  }
}

/** uPlot opts for the dual-axis SOC-bars + kW-line session chart. */
export function buildSessionOpts({ theme, target, kwMax, height = 150 }) {
  return {
    height,
    cursor: { drag: { x: false, y: false } },
    legend: { show: false },
    scales: {
      x: { time: false },
      soc: { range: [0, 100] },
      kw: { range: [0, kwMax] },
    },
    axes: [
      {
        stroke: theme.axisText,
        grid: { stroke: theme.grid, width: 1 },
        values: (u, splits) => splits.map(fmtSessionTime),
      },
      { scale: 'soc', stroke: theme.axisText, grid: { stroke: theme.grid, width: 1 } },
      { side: 1, scale: 'kw', stroke: theme.charging, grid: { show: false } },
    ],
    series: [
      {},
      {
        label: 'SOC',
        scale: 'soc',
        fill: theme.accent + '55',
        stroke: 'transparent',
        paths: uPlot.paths.bars({ size: [0.6, 100] }),
      },
      { label: 'kW', scale: 'kw', stroke: theme.charging, width: 2, fill: theme.charging + '22' },
    ],
    plugins: [limitLinePlugin(target, theme.warning), liveDotPlugin(theme.warning)],
  }
}
```

> Design note: the live dot is **static** (no pulse). Animating a canvas point would need a per-frame redraw loop for marginal value, so the spec's "live-dot pulse off under reduced-motion" row is moot — there is no motion to suppress. Bars/line/dot are redrawn on each 10 s data refresh, which is movement enough.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/rar/openevse-gui-nightshift && npx vitest run src/lib/dashboard/__tests__/sessionChart.test.js`
Expected: PASS (Task 1 + Task 2 assertions).

- [ ] **Step 5: Commit**

```bash
cd /home/rar/openevse-gui-nightshift
git add src/lib/dashboard/sessionChart.js src/lib/dashboard/__tests__/sessionChart.test.js
git commit -m "feat: uPlot opts + dashed limit-line plugin for session chart

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: SessionChart component

**Files:**
- Create: `src/lib/components/dashboard/SessionChart.svelte`
- Test: `src/lib/components/dashboard/__tests__/SessionChart.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/dashboard/__tests__/SessionChart.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import SessionChart from '../SessionChart.svelte'

const S = (ts, a, s) => ({ ts, a, t: 0, e: 0, s })

describe('SessionChart', () => {
  it('shows the collecting placeholder when there are fewer than 2 in-session samples', () => {
    const { getByText } = render(SessionChart, {
      props: { samples: [S(1000, 32, 50)], voltage: 240, target: 80, sessionElapsed: 600 },
    })
    expect(getByText('dashboard.session.collecting')).toBeInTheDocument()
  })

  it('clips to the current session before deciding the placeholder', () => {
    // two samples exist, but only one falls inside the 100 s session window
    const { getByText } = render(SessionChart, {
      props: { samples: [S(1000, 32, 50), S(2000, 32, 60)], voltage: 240, target: 80, sessionElapsed: 100 },
    })
    expect(getByText('dashboard.session.collecting')).toBeInTheDocument()
  })
})
```

> Note: tests deliberately exercise only the placeholder branch. The chart branch mounts `UplotChart`, which uses a canvas uPlot can't initialise under jsdom — the data/opts logic it relies on is already covered by Task 1–2 unit tests.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/rar/openevse-gui-nightshift && npx vitest run src/lib/components/dashboard/__tests__/SessionChart.test.js`
Expected: FAIL — `Failed to resolve import "../SessionChart.svelte"`.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/dashboard/SessionChart.svelte`:

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import UplotChart from '../charts/UplotChart.svelte'
  import { readChartTheme } from '../charts/chartTheme.js'
  import {
    clipToSession,
    toChartData,
    kwAxisMax,
    buildSessionOpts,
  } from '../../dashboard/sessionChart.js'

  let { samples = [], voltage = 0, target = null, sessionElapsed = 0 } = $props()

  let clipped = $derived(clipToSession(samples, sessionElapsed))
  let data = $derived(toChartData(clipped, voltage))
  let opts = $derived.by(() =>
    buildSessionOpts({ theme: readChartTheme(), target, kwMax: kwAxisMax(data[2]) }),
  )
</script>

{#if clipped.length < 2}
  <div class="grid h-[150px] place-items-center text-sm text-text-dim">
    {$_('dashboard.session.collecting')}
  </div>
{:else}
  <UplotChart {opts} {data} />
{/if}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/rar/openevse-gui-nightshift && npx vitest run src/lib/components/dashboard/__tests__/SessionChart.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd /home/rar/openevse-gui-nightshift
git add src/lib/components/dashboard/SessionChart.svelte src/lib/components/dashboard/__tests__/SessionChart.test.js
git commit -m "feat: SessionChart component (combo chart + collecting placeholder)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: i18n strings

**Files:**
- Modify: `src/lib/i18n/en.json`, `src/lib/i18n/es.json`, `src/lib/i18n/fr.json`, `src/lib/i18n/hu.json`

This task comes before ChargingHero so its render test can rely on the keys existing (the test mocks i18n, but the locale-parity test suite checks all four files carry the same keys).

- [ ] **Step 1: Add the `session` block to each locale's `dashboard` object**

In `src/lib/i18n/en.json`, inside the `"dashboard"` object, add:

```json
    "session": {
      "collecting": "Collecting session data…",
      "soc_target": "SOC → {target}%"
    },
```

In `src/lib/i18n/es.json`:

```json
    "session": {
      "collecting": "Recopilando datos de la sesión…",
      "soc_target": "SOC → {target}%"
    },
```

In `src/lib/i18n/fr.json`:

```json
    "session": {
      "collecting": "Collecte des données de session…",
      "soc_target": "SOC → {target}%"
    },
```

In `src/lib/i18n/hu.json`:

```json
    "session": {
      "collecting": "Munkamenet adatainak gyűjtése…",
      "soc_target": "SOC → {target}%"
    },
```

- [ ] **Step 2: Verify JSON validity and key parity**

Run: `cd /home/rar/openevse-gui-nightshift && node -e "for(const l of ['en','es','fr','hu']){const d=require('./src/lib/i18n/'+l+'.json');if(!d.dashboard.session||!d.dashboard.session.collecting||!d.dashboard.session.soc_target)throw new Error('missing in '+l);console.log(l,'ok')}"`
Expected: prints `en ok`, `es ok`, `fr ok`, `hu ok` (no JSON parse / missing-key errors).

- [ ] **Step 3: Run the i18n test suite**

Run: `cd /home/rar/openevse-gui-nightshift && npx vitest run src/lib/i18n`
Expected: PASS (locale-parity / key tests stay green).

- [ ] **Step 4: Commit**

```bash
cd /home/rar/openevse-gui-nightshift
git add src/lib/i18n/en.json src/lib/i18n/es.json src/lib/i18n/fr.json src/lib/i18n/hu.json
git commit -m "i18n: dashboard.session strings for the charging session chart

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: ChargingHero component

**Files:**
- Create: `src/lib/components/dashboard/ChargingHero.svelte`
- Test: `src/lib/components/dashboard/__tests__/ChargingHero.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/dashboard/__tests__/ChargingHero.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) =>
    opts?.values ? k + ':' + JSON.stringify(opts.values) : k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ChargingHero from '../ChargingHero.svelte'

const base = {
  kw: '3.2', soc: 74, target: 80, hasSoc: true,
  mode: 0, modeLocked: false, modeLockLabel: '',
  amps: 32, maxAmps: 48, rateClaimedBy: '', rateNonce: 0,
  samples: [], voltage: 240, sessionElapsed: 600, chartError: false,
  modeDisabled: false, rateDisabled: false,
}

describe('ChargingHero', () => {
  it('shows the live kW value and KW label', () => {
    const { getByText } = render(ChargingHero, { props: { ...base } })
    expect(getByText('3.2')).toBeInTheDocument()
    expect(getByText('KW')).toBeInTheDocument()
  })

  it('shows the SOC readout with the target when SOC is present', () => {
    const { getByText } = render(ChargingHero, { props: { ...base } })
    expect(getByText('74')).toBeInTheDocument()
    expect(getByText('dashboard.session.soc_target:{"target":80}')).toBeInTheDocument()
  })

  it('omits the SOC readout when no vehicle data', () => {
    const { queryByText } = render(ChargingHero, { props: { ...base, hasSoc: false, soc: null } })
    expect(queryByText('dashboard.session.soc_target:{"target":80}')).not.toBeInTheDocument()
  })

  it('renders the chart (collecting placeholder) when there is no error', () => {
    const { getByText } = render(ChargingHero, { props: { ...base } })
    expect(getByText('dashboard.session.collecting')).toBeInTheDocument()
  })

  it('hides the chart entirely on an energy fetch error', () => {
    const { queryByText } = render(ChargingHero, { props: { ...base, chartError: true } })
    expect(queryByText('dashboard.session.collecting')).not.toBeInTheDocument()
    // readout still present
    expect(queryByText('3.2')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd /home/rar/openevse-gui-nightshift && npx vitest run src/lib/components/dashboard/__tests__/ChargingHero.test.js`
Expected: FAIL — `Failed to resolve import "../ChargingHero.svelte"`.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/dashboard/ChargingHero.svelte`:

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import StatusLine from './StatusLine.svelte'
  import ModePill from './ModePill.svelte'
  import RatePill from './RatePill.svelte'
  import SessionChart from './SessionChart.svelte'

  let {
    kw = '0.0',
    soc = null,
    target = null,
    hasSoc = false,
    mode = 0,
    modeLocked = false,
    modeLockLabel = '',
    amps = 6,
    maxAmps = 48,
    rateClaimedBy = '',
    rateNonce = 0,
    samples = [],
    voltage = 0,
    sessionElapsed = 0,
    chartError = false,
    modeDisabled = false,
    rateDisabled = false,
    onmode = () => {},
    onrate = () => {},
  } = $props()
</script>

<div>
  <!-- status row: mode pill · "Charging" · rate pill (placement A) -->
  <div class="flex items-center justify-between gap-2 px-1">
    <ModePill {mode} locked={modeLocked} lockLabel={modeLockLabel} disabled={modeDisabled} {onmode} />
    <StatusLine display="charging" />
    {#key rateNonce}
      <RatePill {amps} min={6} max={maxAmps} claimedBy={rateClaimedBy} disabled={rateDisabled} onchange={onrate} />
    {/key}
  </div>

  <!-- readout strip: keeps the ring's at-a-glance kW · SOC identity -->
  <div class="flex items-center justify-center gap-6 py-3">
    <div class="text-center">
      <div class="text-4xl font-extrabold leading-none text-text">{kw}</div>
      <div class="mt-0.5 text-[10px] font-bold tracking-widest text-accent">KW</div>
    </div>
    {#if hasSoc && soc != null}
      <div class="w-px self-stretch bg-border"></div>
      <div class="text-center">
        <div class="text-4xl font-extrabold leading-none text-text">{soc}<span class="text-xl">%</span></div>
        <div class="mt-0.5 text-[10px] font-bold tracking-wide text-text-dim">
          {$_('dashboard.session.soc_target', { values: { target } })}
        </div>
      </div>
    {/if}
  </div>

  {#if !chartError}
    <SessionChart {samples} {voltage} {target} {sessionElapsed} />
  {/if}
</div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/rar/openevse-gui-nightshift && npx vitest run src/lib/components/dashboard/__tests__/ChargingHero.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /home/rar/openevse-gui-nightshift
git add src/lib/components/dashboard/ChargingHero.svelte src/lib/components/dashboard/__tests__/ChargingHero.test.js
git commit -m "feat: ChargingHero — status-row pills + kW/SOC readout + session chart

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire into Dashboard — hero swap + polling

**Files:**
- Modify: `src/routes/Dashboard.svelte`

There are no new unit tests here (Dashboard has no existing route test harness for the ring region; logic is covered by Task 1–5). Verification is the full suite + a build. Follow the exact edits below.

- [ ] **Step 1: Add imports**

In `src/routes/Dashboard.svelte`, after the existing `import { fade }`-free import block, add the energy store and the new component. Specifically:

After line `import { plan_store } from '../lib/stores/plan.js'` add:

```js
  import { energy_store } from '../lib/stores/energy.js'
```

After line `import PowerRing from '../lib/components/dashboard/PowerRing.svelte'` add:

```js
  import ChargingHero from '../lib/components/dashboard/ChargingHero.svelte'
```

At the very top of the `<script>` imports (with the other `svelte` imports — there are none yet, so add it right after the `import { _ } from 'svelte-i18n'` line):

```js
  import { fade } from 'svelte/transition'
```

- [ ] **Step 2: Add the `/energy/raw` polling effect**

In the `<script>`, immediately after the `cancelBoost` function (just before the closing `</script>` at line ~338), add:

```js
  // While charging, refresh the raw energy log every 10 s so the session chart
  // tracks live. The raw log isn't version-bumped like the pull stores, so we
  // poll it ourselves. The effect re-runs when `charging` flips; its cleanup
  // clears the interval, so polling starts/stops with the charging state.
  $effect(() => {
    if (!charging) return
    energy_store.loadRaw()
    const id = setInterval(() => energy_store.loadRaw(), 10000)
    return () => clearInterval(id)
  })
```

- [ ] **Step 3: Gate the top StatusLine and swap the hero**

Replace this block (currently lines ~340–374):

```svelte
<section class="px-4 pb-4">
  <StatusLine {display} />

  <div class="relative">
    <div class="absolute left-3 top-1 z-10">
      <ModePill
        {mode}
        locked={modeLocked}
        lockLabel={modeLockLabel}
        disabled={busy || display === 'error'}
        onmode={setMode}
      />
    </div>
    <div class="absolute right-3 top-1 z-10">
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

with:

```svelte
<section class="px-4 pb-4">
  {#if !charging}
    <StatusLine {display} />
  {/if}

  <div class="relative">
    {#if charging}
      <div in:fade={{ duration: 150 }}>
        <ChargingHero
          {kw}
          soc={hasSoc ? ($status_store?.battery_level ?? null) : null}
          target={socTarget}
          {hasSoc}
          {mode}
          {modeLocked}
          {modeLockLabel}
          amps={chargeAmps}
          {maxAmps}
          {rateClaimedBy}
          {rateNonce}
          samples={$energy_store.raw.samples}
          voltage={$status_store?.voltage ?? 0}
          sessionElapsed={$status_store?.session_elapsed ?? 0}
          chartError={$energy_store.error.raw}
          modeDisabled={busy || display === 'error'}
          rateDisabled={busy || ecoOn || display === 'error'}
          onmode={setMode}
          onrate={setChargeAmps}
        />
      </div>
    {:else}
      <div in:fade={{ duration: 150 }}>
        <div class="absolute left-3 top-1 z-10">
          <ModePill
            {mode}
            locked={modeLocked}
            lockLabel={modeLockLabel}
            disabled={busy || display === 'error'}
            onmode={setMode}
          />
        </div>
        <div class="absolute right-3 top-1 z-10">
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
    {/if}
  </div>
```

(The rest of the `<section>` — `ThrottleBadge`, `StatChips`, `EcoShaperToggles`, `ChargeLimitCard`, etc. — is unchanged.)

- [ ] **Step 4: Run the full test suite**

Run: `cd /home/rar/openevse-gui-nightshift && npm test`
Expected: PASS — all existing tests plus the new ones (no regressions).

- [ ] **Step 5: Verify the production build**

Run: `cd /home/rar/openevse-gui-nightshift && npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/rar/openevse-gui-nightshift
git add src/routes/Dashboard.svelte
git commit -m "feat: swap PowerRing for ChargingHero while charging + poll /energy/raw

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Manual verification (after all tasks)

With the dev server (`npm run dev`, pointed at a device or `npm run dev:mock`):

1. **Idle** → PowerRing shows as today, pills float in the corners, single top StatusLine.
2. **Start charging** → hero crossfades to: status row (`mode · Charging · rate`), kW/SOC readout, combo chart (SOC bars + kW line, dashed limit line at the EVSE limit).
3. **Early session (<2 samples)** → "Collecting session data…" placeholder in the chart slot.
4. **No vehicle SOC** (`s` = −1) → bars absent, kW line only, no SOC readout half.
5. **Chart over time** → bars climb, kW line tracks, amber live dot at the right edge.
6. **Stop charging** → crossfades back to the ring.
```
