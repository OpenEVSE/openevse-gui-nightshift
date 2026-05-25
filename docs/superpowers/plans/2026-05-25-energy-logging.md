# Energy Logging + Temp Throttle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring v3 (openevse-gui-nightshift) to feature parity with chris1howell's v2 energy logging + temp throttle work, built on uPlot and styled to the v3 visual language.

**Architecture:** A new "Energy" tab is added to the existing Monitoring screen, with sub-views Live / Daily / Monthly / Annual sharing a single theme-aware uPlot wrapper. A `stores/energy.js` factory fetches `/api/energy/{raw,daily,monthly,annual}` through `serialQueue`. Temp throttle config (toggle + 40–80°C slider) is added inline to Settings → Safety. A `ThrottleBadge` on the Dashboard activates whenever the temp-throttle EvseClient holds the `charge_current` claim — no new status field needed.

**Tech Stack:** Svelte 5 (runes), Tailwind 4 (CSS-var theme tokens), uPlot 1.6, Vite 8, Vitest 4, svelte-i18n 4, Luxon.

**Spec:** `docs/superpowers/specs/2026-05-25-energy-logging-design.md`

**Branch:** `feat/energy-logging` (already created, contains the spec commit `9ffe779`).

---

## Task 1: Add uPlot dependency and chart manualChunk

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`

- [ ] **Step 1: Install uPlot**

Run from `/home/rar/openevse-gui-nightshift`:
```bash
npm install uplot@^1.6.32
```

- [ ] **Step 2: Add a `charts` manualChunk for uplot**

Edit `vite.config.js`, replacing the existing `manualChunks` arrow:
```javascript
manualChunks: (id) => {
  if (id.includes('/node_modules/uplot/')) return 'charts'
  if (['luxon', 'svelte-i18n', 'iconify-icon'].some((pkg) => id.includes(`/node_modules/${pkg}/`))) {
    return 'vendor'
  }
},
```

- [ ] **Step 3: Verify the build still works**

```bash
npm run build
```
Expected: clean build; check `dist/assets/charts-*.js` appears.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vite.config.js
git commit -m "build: add uPlot in its own 'charts' manual chunk"
```

---

## Task 2: Register the temp-throttle EvseClient

**Files:**
- Modify: `src/lib/vars.js`
- Create: `src/lib/__tests__/vars.test.js` (only if not already present — check first)

The firmware claim id is `EVC(EvseClient_Vendor_OpenEVSE, 0x000D)` = `0x0001000D` = `65549`. Priority matches `error` (Safety, 10000).

- [ ] **Step 1: Write the failing test**

If `src/lib/__tests__/vars.test.js` doesn't exist, create it; otherwise add the new `it` block:
```javascript
import { describe, it, expect } from 'vitest'
import { EvseClients } from '../vars.js'

describe('EvseClients', () => {
  it('exposes the temperature-throttle client with id 0x0001000D and Safety priority', () => {
    expect(EvseClients.tempThrottle).toEqual({ id: 0x0001000D, priority: 10000 })
  })
})
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
npx vitest run src/lib/__tests__/vars.test.js
```
Expected: `EvseClients.tempThrottle` is undefined.

- [ ] **Step 3: Add the entry**

Edit `src/lib/vars.js`, adding to the `EvseClients` map:
```javascript
tempThrottle: { id: 0x0001000D, priority: 10000 },
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
npx vitest run src/lib/__tests__/vars.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/vars.js src/lib/__tests__/vars.test.js
git commit -m "vars: register temp-throttle EvseClient (0x0001000D)"
```

---

## Task 3: Energy store

**Files:**
- Create: `src/lib/stores/energy.js`
- Create: `src/lib/stores/__tests__/energy.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/stores/__tests__/energy.test.js`:
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))
vi.mock('../../queue.js', () => ({
  serialQueue: { add: vi.fn((fn) => fn()) },
}))

import { energy_store } from '../energy.js'
import { httpAPI } from '../../api/httpAPI.js'

describe('energy_store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    energy_store.reset()
  })

  it('starts empty', () => {
    const s = get(energy_store)
    expect(s.raw.samples).toEqual([])
    expect(s.raw.historical).toBe(false)
    expect(s.raw.noOlder).toBe(false)
    expect(s.loading.raw).toBe(false)
    expect(s.error.raw).toBe(false)
  })

  it('loadRaw() fetches /energy/raw and populates samples', async () => {
    httpAPI.mockResolvedValue({ samples: [{ ts: 1, a: 0, t: 33, e: 0 }] })
    const ok = await energy_store.loadRaw()
    expect(ok).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('GET', '/energy/raw')
    const s = get(energy_store)
    expect(s.raw.samples).toHaveLength(1)
    expect(s.raw.historical).toBe(false)
  })

  it('loadRaw(before) sets historical and uses the before param', async () => {
    httpAPI.mockResolvedValue({ samples: [{ ts: 1, a: 0, t: 33, e: 0 }] })
    await energy_store.loadRaw(12345)
    expect(httpAPI).toHaveBeenCalledWith('GET', '/energy/raw?before=12345')
    const s = get(energy_store)
    expect(s.raw.historical).toBe(true)
  })

  it('loadRaw(before) with empty response sets noOlder and keeps samples', async () => {
    httpAPI.mockResolvedValueOnce({ samples: [{ ts: 1, a: 0, t: 33, e: 0 }] })
    await energy_store.loadRaw()
    httpAPI.mockResolvedValueOnce({ samples: [] })
    await energy_store.loadRaw(1)
    const s = get(energy_store)
    expect(s.raw.noOlder).toBe(true)
    expect(s.raw.samples).toHaveLength(1)
  })

  it('loadRaw() sets error on httpAPI failure', async () => {
    httpAPI.mockResolvedValue('error')
    const ok = await energy_store.loadRaw()
    expect(ok).toBe(false)
    expect(get(energy_store).error.raw).toBe(true)
  })

  it('loadDaily / loadMonthly / loadAnnual fetch their endpoints', async () => {
    httpAPI.mockResolvedValue({ daily: [{ d: '2026-05-24', kwh: 12.3 }] })
    await energy_store.loadDaily()
    expect(httpAPI).toHaveBeenLastCalledWith('GET', '/energy/daily')

    httpAPI.mockResolvedValue({ monthly: [] })
    await energy_store.loadMonthly()
    expect(httpAPI).toHaveBeenLastCalledWith('GET', '/energy/monthly')

    httpAPI.mockResolvedValue({ annual: [] })
    await energy_store.loadAnnual()
    expect(httpAPI).toHaveBeenLastCalledWith('GET', '/energy/annual')
  })
})
```

- [ ] **Step 2: Run tests (expect FAIL — module missing)**

```bash
npx vitest run src/lib/stores/__tests__/energy.test.js
```

- [ ] **Step 3: Implement the store**

Create `src/lib/stores/energy.js`:
```javascript
import { writable } from 'svelte/store'
import { httpAPI } from '../api/httpAPI.js'
import { serialQueue } from '../queue.js'

function emptyState() {
  return {
    raw: { samples: [], historical: false, noOlder: false },
    daily: [],
    monthly: [],
    annual: [],
    loading: { raw: false, daily: false, monthly: false, annual: false },
    error:   { raw: false, daily: false, monthly: false, annual: false },
  }
}

function createEnergyStore() {
  const P = writable(emptyState())
  const { subscribe, update, set } = P

  function setLoading(key, v) { update((s) => ({ ...s, loading: { ...s.loading, [key]: v } })) }
  function setError(key, v)   { update((s) => ({ ...s, error:   { ...s.error,   [key]: v } })) }

  async function loadRaw(before = 0) {
    const url = before > 0 ? `/energy/raw?before=${before}` : '/energy/raw'
    setLoading('raw', true); setError('raw', false)
    const res = await serialQueue.add(() => httpAPI('GET', url))
    setLoading('raw', false)
    if (!res || res === 'error' || res.msg === 'error' || !Array.isArray(res.samples)) {
      setError('raw', true)
      return false
    }
    update((s) => {
      const historical = before > 0
      if (historical && res.samples.length === 0) {
        return { ...s, raw: { ...s.raw, noOlder: true } }
      }
      return { ...s, raw: { samples: res.samples, historical, noOlder: false } }
    })
    return true
  }

  async function loadSummary(key, urlPath, fieldName) {
    setLoading(key, true); setError(key, false)
    const res = await serialQueue.add(() => httpAPI('GET', urlPath))
    setLoading(key, false)
    if (!res || res === 'error' || res.msg === 'error' || !Array.isArray(res[fieldName])) {
      setError(key, true)
      return false
    }
    update((s) => ({ ...s, [key]: res[fieldName] }))
    return true
  }

  return {
    subscribe,
    set,
    reset: () => set(emptyState()),
    loadRaw,
    loadDaily:   () => loadSummary('daily',   '/energy/daily',   'daily'),
    loadMonthly: () => loadSummary('monthly', '/energy/monthly', 'monthly'),
    loadAnnual:  () => loadSummary('annual',  '/energy/annual',  'annual'),
  }
}

export const energy_store = createEnergyStore()
```

- [ ] **Step 4: Run tests (expect PASS)**

```bash
npx vitest run src/lib/stores/__tests__/energy.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/energy.js src/lib/stores/__tests__/energy.test.js
git commit -m "stores: energy — fetch raw + daily/monthly/annual via serialQueue"
```

---

## Task 4: Mock endpoints for dev:mock mode

**Files:**
- Create: `dev/fixtures/energy_raw.json`
- Modify: `dev/mock-plugin.js`

- [ ] **Step 1: Create the raw fixture**

Create `dev/fixtures/energy_raw.json` with realistic shape — 40 samples at 60s intervals, simulating a charging session ramp:
```json
{"samples":[
{"ts":1779055985,"a":0,"t":22.1,"e":0},
{"ts":1779056045,"a":0,"t":22.2,"e":0},
{"ts":1779056105,"a":0,"t":22.4,"e":0},
{"ts":1779056165,"a":12,"t":23.0,"e":120},
{"ts":1779056225,"a":24,"t":24.5,"e":480},
{"ts":1779056285,"a":32,"t":26.8,"e":1120},
{"ts":1779056345,"a":32,"t":28.4,"e":1760},
{"ts":1779056405,"a":32,"t":29.7,"e":2400},
{"ts":1779056465,"a":32,"t":30.8,"e":3040},
{"ts":1779056525,"a":32,"t":31.6,"e":3680},
{"ts":1779056585,"a":32,"t":32.3,"e":4320},
{"ts":1779056645,"a":32,"t":32.9,"e":4960},
{"ts":1779056705,"a":32,"t":33.4,"e":5600},
{"ts":1779056765,"a":32,"t":33.8,"e":6240},
{"ts":1779056825,"a":32,"t":34.1,"e":6880},
{"ts":1779056885,"a":32,"t":34.3,"e":7520},
{"ts":1779056945,"a":32,"t":34.5,"e":8160},
{"ts":1779057005,"a":32,"t":34.6,"e":8800},
{"ts":1779057065,"a":32,"t":34.7,"e":9440},
{"ts":1779057125,"a":32,"t":34.7,"e":10080},
{"ts":1779057185,"a":32,"t":34.8,"e":10720},
{"ts":1779057245,"a":32,"t":34.8,"e":11360},
{"ts":1779057305,"a":32,"t":34.8,"e":12000},
{"ts":1779057365,"a":28,"t":34.7,"e":12560},
{"ts":1779057425,"a":24,"t":34.5,"e":13040},
{"ts":1779057485,"a":16,"t":34.1,"e":13360},
{"ts":1779057545,"a":8,"t":33.6,"e":13520},
{"ts":1779057605,"a":0,"t":33.0,"e":13520},
{"ts":1779057665,"a":0,"t":32.4,"e":13520},
{"ts":1779057725,"a":0,"t":31.8,"e":13520},
{"ts":1779057785,"a":0,"t":31.3,"e":13520},
{"ts":1779057845,"a":0,"t":30.8,"e":13520},
{"ts":1779057905,"a":0,"t":30.4,"e":13520},
{"ts":1779057965,"a":0,"t":30.0,"e":13520},
{"ts":1779058025,"a":0,"t":29.7,"e":13520},
{"ts":1779058085,"a":0,"t":29.4,"e":13520},
{"ts":1779058145,"a":0,"t":29.1,"e":13520},
{"ts":1779058205,"a":0,"t":28.9,"e":13520},
{"ts":1779058265,"a":0,"t":28.7,"e":13520},
{"ts":1779058325,"a":0,"t":28.5,"e":13520}
]}
```

- [ ] **Step 2: Register the energy fixtures in `dev/mock-plugin.js`**

Read `dev/mock-plugin.js` to find the `fixtures` object and the request-router. Add to the `fixtures` map:
```javascript
'/api/energy/raw':     loadFixture('energy_raw.json'),
'/api/energy/daily':   '{"daily":[]}',
'/api/energy/monthly': '{"monthly":[]}',
'/api/energy/annual':  '{"annual":[]}',
```

Find the routing block that matches `req.url` against fixture keys. Just before the generic exact-match check, add a `?before=` short-circuit so the Older button exercises the empty path:
```javascript
if (req.url.startsWith('/api/energy/raw?before=')) {
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ samples: [] }))
  return
}
```

(If the existing router uses a different match style, conform to it. The intent: exact-match `/api/energy/raw` returns the fixture; with `?before=` returns empty.)

- [ ] **Step 3: Verify with the dev server**

```bash
npm run dev:mock &
sleep 3
curl -s http://localhost:5173/api/energy/raw | head -c 200
curl -s 'http://localhost:5173/api/energy/raw?before=1779055985'
kill %1
```
Expected: first curl shows samples JSON; second returns `{"samples":[]}`.

- [ ] **Step 4: Commit**

```bash
git add dev/fixtures/energy_raw.json dev/mock-plugin.js
git commit -m "dev: mock /api/energy/{raw,daily,monthly,annual} endpoints"
```

---

## Task 5: chartTheme helper

**Files:**
- Create: `src/lib/components/charts/chartTheme.js`
- Create: `src/lib/components/charts/__tests__/chartTheme.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/charts/__tests__/chartTheme.test.js`:
```javascript
import { describe, it, expect, beforeEach } from 'vitest'
import { readChartTheme } from '../chartTheme.js'

function setVar(name, value) {
  document.documentElement.style.setProperty(name, value)
}

describe('readChartTheme', () => {
  beforeEach(() => {
    setVar('--accent',   '#0f9b98')
    setVar('--charging', '#0f9b98')
    setVar('--warning',  '#d98a2b')
    setVar('--text-dim', '#5b6b72')
    setVar('--border',   '#e4eae9')
  })

  it('resolves the documented CSS vars', () => {
    const t = readChartTheme()
    expect(t.accent).toBe('#0f9b98')
    expect(t.charging).toBe('#0f9b98')
    expect(t.warning).toBe('#d98a2b')
    expect(t.axisText).toBe('#5b6b72')
    expect(t.grid).toBe('#e4eae9')
  })

  it('falls back to safe defaults when a var is missing', () => {
    setVar('--accent', '')
    const t = readChartTheme()
    expect(t.accent).toMatch(/^#/)
  })
})
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
npx vitest run src/lib/components/charts/__tests__/chartTheme.test.js
```

- [ ] **Step 3: Implement the helper**

Create `src/lib/components/charts/chartTheme.js`:
```javascript
function v(name, fallback) {
  if (typeof document === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return raw || fallback
}

export function readChartTheme() {
  return {
    accent:   v('--accent',   '#0f9b98'),
    charging: v('--charging', '#0f9b98'),
    warning:  v('--warning',  '#d98a2b'),
    axisText: v('--text-dim', '#5b6b72'),
    grid:     v('--border',   '#e4eae9'),
  }
}
```

- [ ] **Step 4: Run tests (expect PASS)**

```bash
npx vitest run src/lib/components/charts/__tests__/chartTheme.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/charts/chartTheme.js src/lib/components/charts/__tests__/chartTheme.test.js
git commit -m "charts: chartTheme helper resolving Tailwind CSS vars"
```

---

## Task 6: UplotChart wrapper

**Files:**
- Create: `src/lib/components/charts/UplotChart.svelte`
- Create: `src/lib/components/charts/__tests__/UplotChart.test.js`

uPlot uses canvas; jsdom doesn't render canvas. Tests verify the wrapper mounts, calls construct/destroy at the right times, and reacts to `data` / theme changes — without asserting pixels.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/charts/__tests__/UplotChart.test.js`:
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'

const ctor = vi.fn()
const setData = vi.fn()
const setSize = vi.fn()
const destroy = vi.fn()

vi.mock('uplot', () => {
  return {
    default: class MockUplot {
      constructor(opts, data, target) { ctor(opts, data, target); }
      setData = setData
      setSize = setSize
      destroy = destroy
    },
  }
})

import UplotChart from '../UplotChart.svelte'

describe('UplotChart', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('constructs uPlot on mount with the supplied opts and data', () => {
    const opts = { width: 500, height: 200, series: [{}, {}] }
    const data = [[1, 2, 3], [10, 20, 30]]
    render(UplotChart, { props: { opts, data } })
    expect(ctor).toHaveBeenCalledTimes(1)
    const [calledOpts, calledData] = ctor.mock.calls[0]
    expect(calledOpts.series).toEqual(opts.series)
    expect(calledData).toBe(data)
  })

  it('destroys uPlot on unmount', () => {
    const { unmount } = render(UplotChart, { props: { opts: { series: [{}] }, data: [[1]] } })
    unmount()
    expect(destroy).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test (expect FAIL — component missing)**

```bash
npx vitest run src/lib/components/charts/__tests__/UplotChart.test.js
```

- [ ] **Step 3: Implement the wrapper**

Create `src/lib/components/charts/UplotChart.svelte`:
```svelte
<script>
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'

  let { opts, data } = $props()

  let container
  /** @type {uPlot | null} */
  let chart = null
  /** @type {ResizeObserver | null} */
  let ro = null
  /** @type {MutationObserver | null} */
  let mo = null

  function rebuild() {
    if (!container) return
    if (chart) { chart.destroy(); chart = null }
    const width = container.clientWidth || 600
    const o = { ...opts, width, height: opts.height ?? 260 }
    chart = new uPlot(o, data, container)
  }

  $effect(() => {
    rebuild()
    ro = new ResizeObserver(() => {
      if (chart && container) chart.setSize({ width: container.clientWidth, height: chart.height })
    })
    ro.observe(container)
    mo = new MutationObserver(() => rebuild())
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      ro?.disconnect()
      mo?.disconnect()
      chart?.destroy()
      chart = null
    }
  })

  $effect(() => {
    // React to data changes after initial mount
    if (chart) chart.setData(data)
  })
</script>

<div bind:this={container} class="w-full"></div>
```

- [ ] **Step 4: Run tests (expect PASS)**

```bash
npx vitest run src/lib/components/charts/__tests__/UplotChart.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/charts/UplotChart.svelte src/lib/components/charts/__tests__/UplotChart.test.js
git commit -m "charts: UplotChart wrapper — resize + theme-aware rebuild"
```

---

## Task 7: EnergyLiveChart component

**Files:**
- Create: `src/lib/components/charts/EnergyLiveChart.svelte`

Visual smoke test only — no unit test (the wrapper + theme already have coverage; chart-builder is mostly config). The chart consumes raw samples and renders dual-axis amps + °C with smooth lines and an accent-tinted fill.

- [ ] **Step 1: Implement the component**

Create `src/lib/components/charts/EnergyLiveChart.svelte`:
```svelte
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../stores/config.js'
  import UplotChart from './UplotChart.svelte'
  import { readChartTheme } from './chartTheme.js'

  /** @type {{ samples: Array<{ts:number,a:number,t:number,e:number}> }} */
  let { samples = [] } = $props()

  let data = $derived.by(() => {
    const x = samples.map((s) => s.ts)
    const a = samples.map((s) => s.a)
    const t = samples.map((s) => (s.t > 0 ? s.t : null))
    return [x, a, t]
  })

  let opts = $derived.by(() => {
    const theme = readChartTheme()
    const ampMax = ($config_store?.max_current_hard ?? 50) + 5
    return {
      height: 280,
      cursor: { drag: { x: false, y: false } },
      legend: { show: true },
      scales: {
        x: { time: true },
        a: { range: [0, ampMax] },
        t: { range: [-20, 80] },
      },
      axes: [
        { stroke: theme.axisText, grid: { stroke: theme.grid, width: 1 } },
        { scale: 'a', label: $_('monitoring.energy.axis.current'), stroke: theme.charging, grid: { stroke: theme.grid, width: 1 } },
        { side: 1, scale: 't', label: $_('monitoring.energy.axis.temperature'), stroke: theme.warning, grid: { show: false } },
      ],
      series: [
        {},
        { label: 'A', scale: 'a', stroke: theme.charging, width: 2, fill: theme.charging + '22' },
        { label: '°C', scale: 't', stroke: theme.warning, width: 2 },
      ],
    }
  })
</script>

{#if samples.length === 0}
  <div class="py-12 text-center text-sm text-text-dim">{$_('monitoring.energy.no_samples')}</div>
{:else}
  <UplotChart {opts} {data} />
{/if}
```

- [ ] **Step 2: Verify the build still works**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/charts/EnergyLiveChart.svelte
git commit -m "charts: EnergyLiveChart — dual-axis A/°C live view"
```

---

## Task 8: EnergySummaryChart component

**Files:**
- Create: `src/lib/components/charts/EnergySummaryChart.svelte`

- [ ] **Step 1: Implement the component**

Create `src/lib/components/charts/EnergySummaryChart.svelte`:
```svelte
<script>
  import { _ } from 'svelte-i18n'
  import uPlot from 'uplot'
  import UplotChart from './UplotChart.svelte'
  import { readChartTheme } from './chartTheme.js'

  /**
   * @typedef {Object} Row
   * @property {string} label  X-axis label (e.g. "2026-05-24", "May", "2025")
   * @property {number} kwh    Energy total for the bucket
   */
  /** @type {{ rows: Row[] }} */
  let { rows = [] } = $props()

  let data = $derived.by(() => {
    // Use ordinal x positions (0..n-1) and emit string labels via splits/values.
    const xs = rows.map((_r, i) => i)
    const ys = rows.map((r) => r.kwh)
    return [xs, ys]
  })

  let opts = $derived.by(() => {
    const theme = readChartTheme()
    return {
      height: 260,
      legend: { show: false },
      cursor: { drag: { x: false, y: false } },
      scales: {
        x: { time: false, range: (_u, _min, _max) => [-0.5, Math.max(0, rows.length - 0.5)] },
      },
      axes: [
        {
          stroke: theme.axisText,
          grid: { stroke: theme.grid, width: 1 },
          splits: () => rows.map((_r, i) => i),
          values: () => rows.map((r) => r.label),
        },
        {
          stroke: theme.axisText,
          grid: { stroke: theme.grid, width: 1 },
          label: 'kWh',
        },
      ],
      series: [
        {},
        {
          label: 'kWh',
          stroke: theme.accent,
          fill: theme.accent + '55',
          width: 1,
          paths: uPlot.paths.bars({ size: [0.65, 60] }),
          points: { show: false },
        },
      ],
    }
  })
</script>

{#if rows.length === 0}
  <div class="py-12 text-center text-sm text-text-dim">{$_('monitoring.energy.no_samples')}</div>
{:else}
  <UplotChart {opts} {data} />
{/if}
```

- [ ] **Step 2: Verify the build still works**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/charts/EnergySummaryChart.svelte
git commit -m "charts: EnergySummaryChart — bar view for daily/monthly/annual"
```

---

## Task 9: EnergyTab — sub-tab switcher and chart host

**Files:**
- Create: `src/lib/components/monitoring/EnergyTab.svelte`
- Create: `src/lib/components/monitoring/__tests__/EnergyTab.test.js`

The tab maintains its own `view` state (live | daily | monthly | annual), calls the matching `energy_store.load*()` on activation, and renders the matching chart.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/monitoring/__tests__/EnergyTab.test.js`:
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'

const loadRaw = vi.fn(async () => true)
const loadDaily = vi.fn(async () => true)
const loadMonthly = vi.fn(async () => true)
const loadAnnual = vi.fn(async () => true)

vi.mock('../../../stores/energy.js', async () => {
  const { writable } = await import('svelte/store')
  const store = writable({
    raw: { samples: [], historical: false, noOlder: false },
    daily: [], monthly: [], annual: [],
    loading: { raw: false, daily: false, monthly: false, annual: false },
    error:   { raw: false, daily: false, monthly: false, annual: false },
  })
  return {
    energy_store: { ...store, loadRaw, loadDaily, loadMonthly, loadAnnual },
  }
})

// Stub chart components — they require canvas
vi.mock('../../charts/EnergyLiveChart.svelte', async () => {
  const { default: Stub } = await import('./_stub.svelte')
  return { default: Stub }
})
vi.mock('../../charts/EnergySummaryChart.svelte', async () => {
  const { default: Stub } = await import('./_stub.svelte')
  return { default: Stub }
})

import EnergyTab from '../EnergyTab.svelte'

describe('EnergyTab', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('loads raw on mount (live is the default view)', () => {
    render(EnergyTab)
    expect(loadRaw).toHaveBeenCalledTimes(1)
  })

  it('switches view and calls the matching loader', async () => {
    render(EnergyTab)
    await fireEvent.click(screen.getByRole('tab', { name: /daily/i }))
    expect(loadDaily).toHaveBeenCalled()
    await fireEvent.click(screen.getByRole('tab', { name: /monthly/i }))
    expect(loadMonthly).toHaveBeenCalled()
    await fireEvent.click(screen.getByRole('tab', { name: /annual/i }))
    expect(loadAnnual).toHaveBeenCalled()
  })
})
```

Also create the trivial chart stub `src/lib/components/monitoring/__tests__/_stub.svelte`:
```svelte
<div data-testid="chart-stub"></div>
```

- [ ] **Step 2: Run tests (expect FAIL)**

```bash
npx vitest run src/lib/components/monitoring/__tests__/EnergyTab.test.js
```

- [ ] **Step 3: Implement the component**

Create `src/lib/components/monitoring/EnergyTab.svelte`:
```svelte
<script>
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import { energy_store } from '../../stores/energy.js'
  import Tabs from '../ui/Tabs.svelte'
  import Button from '../ui/Button.svelte'
  import EnergyLiveChart from '../charts/EnergyLiveChart.svelte'
  import EnergySummaryChart from '../charts/EnergySummaryChart.svelte'

  const VIEWS = ['live', 'daily', 'monthly', 'annual']

  let viewIndex = $state(0)
  let view = $derived(VIEWS[viewIndex])

  let summaryRows = $derived.by(() => {
    if (view === 'daily')   return $energy_store.daily  .map((r) => ({ label: r.d ?? r.label ?? '', kwh: r.kwh ?? 0 }))
    if (view === 'monthly') return $energy_store.monthly.map((r) => ({ label: r.m ?? r.label ?? '', kwh: r.kwh ?? 0 }))
    if (view === 'annual')  return $energy_store.annual .map((r) => ({ label: String(r.y ?? r.label ?? ''), kwh: r.kwh ?? 0 }))
    return []
  })

  function loadFor(v) {
    if (v === 'live')    return energy_store.loadRaw()
    if (v === 'daily')   return energy_store.loadDaily()
    if (v === 'monthly') return energy_store.loadMonthly()
    if (v === 'annual')  return energy_store.loadAnnual()
  }

  function onTabChange(i) { viewIndex = i; loadFor(VIEWS[i]) }

  onMount(() => { loadFor('live') })

  // Auto-refresh the live view every 60s while not viewing historical paging
  let timer
  $effect(() => {
    clearInterval(timer)
    if (view === 'live') {
      timer = setInterval(() => {
        if (!$energy_store.raw.historical) energy_store.loadRaw()
      }, 60000)
    }
    return () => clearInterval(timer)
  })

  let tabs = $derived([
    { label: $_('monitoring.energy.live') },
    { label: $_('monitoring.energy.daily') },
    { label: $_('monitoring.energy.monthly') },
    { label: $_('monitoring.energy.annual') },
  ])

  function olderClicked() {
    const samples = $energy_store.raw.samples
    if (!samples.length) return
    const oldest = Math.min(...samples.map((s) => s.ts))
    energy_store.loadRaw(oldest)
  }
  function currentClicked() { energy_store.loadRaw() }
</script>

<div class="space-y-3">
  <Tabs {tabs} active={viewIndex} onchange={onTabChange} />

  {#if view === 'live'}
    <div class="flex items-center justify-between text-xs text-text-dim">
      <Button
        size="sm"
        label={$_('monitoring.energy.older')}
        disabled={$energy_store.loading.raw || $energy_store.raw.noOlder || !$energy_store.raw.samples.length}
        onclick={olderClicked}
      />
      <span>
        {#if $energy_store.raw.noOlder}{$_('monitoring.energy.no_older')}
        {:else if $energy_store.raw.historical}{$_('monitoring.energy.historical')}
        {:else}{$_('monitoring.energy.latest_samples', { values: { n: $energy_store.raw.samples.length } })}{/if}
      </span>
      {#if $energy_store.raw.historical}
        <Button size="sm" label={$_('monitoring.energy.current')} onclick={currentClicked} />
      {:else}
        <span class="w-16"></span>
      {/if}
    </div>

    {#if $energy_store.error.raw}
      <div class="py-12 text-center text-sm text-error">{$_('monitoring.energy.error')}</div>
    {:else}
      <EnergyLiveChart samples={$energy_store.raw.samples} />
    {/if}
  {:else}
    {#if $energy_store.error[view]}
      <div class="py-12 text-center text-sm text-error">{$_('monitoring.energy.error')}</div>
    {:else}
      <EnergySummaryChart rows={summaryRows} />
    {/if}
  {/if}
</div>
```

- [ ] **Step 4: Run tests (expect PASS)**

```bash
npx vitest run src/lib/components/monitoring/__tests__/EnergyTab.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/monitoring src/lib/components/charts
git commit -m "monitoring: EnergyTab — live + daily/monthly/annual sub-views"
```

---

## Task 10: Wire Energy tab into Monitoring page

**Files:**
- Modify: `src/routes/Monitoring.svelte`

- [ ] **Step 1: Add the import + tab + render branch**

Edit `src/routes/Monitoring.svelte`. Add to the imports block:
```javascript
import EnergyTab from '../lib/components/monitoring/EnergyTab.svelte'
```

In the `tabs` derived array, append:
```javascript
{ label: $_('monitoring.tab.energy'), alert: false },
```

In the render block, add a fourth branch after `activeTab === 2`:
```svelte
{:else if activeTab === 2}
  <ManagerTab rows={claims} />
{:else}
  <EnergyTab />
{/if}
```

- [ ] **Step 2: Build + run dev:mock to eyeball it**

```bash
npm run build
npm run dev:mock &
sleep 3
# open http://localhost:5173/#/monitoring in browser, click Energy tab
kill %1
```
Expected: tab renders with a chart from the mock fixture; sub-tabs switch.

- [ ] **Step 3: Run all tests**

```bash
npm test
```
Expected: 100% pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/Monitoring.svelte
git commit -m "monitoring: add Energy as 4th tab"
```

---

## Task 11: ThrottleBadge component

**Files:**
- Create: `src/lib/components/dashboard/ThrottleBadge.svelte`
- Create: `src/lib/components/dashboard/__tests__/ThrottleBadge.test.js`

Detect throttle by checking whether `EvseClients.tempThrottle.id` owns `claims.charge_current` in `claims_target_store`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/dashboard/__tests__/ThrottleBadge.test.js`:
```javascript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import { writable } from 'svelte/store'
import { EvseClients } from '../../../vars.js'

const claims = writable({
  properties: { state: null, charge_current: null, max_current: null, auto_release: null },
  claims:     { state: null, charge_current: null, max_current: null, auto_release: null },
})

vi.mock('../../../stores/claims_target.js', () => ({ claims_target_store: claims }))

import ThrottleBadge from '../ThrottleBadge.svelte'

describe('ThrottleBadge', () => {
  it('renders nothing when temp-throttle claim is absent', () => {
    claims.set({ properties: {}, claims: { charge_current: EvseClients.manual.id } })
    const { container } = render(ThrottleBadge)
    expect(container.textContent.trim()).toBe('')
  })

  it('renders the throttled current when the temp-throttle claim is active', () => {
    claims.set({
      properties: { charge_current: 18 },
      claims:     { charge_current: EvseClients.tempThrottle.id },
    })
    render(ThrottleBadge)
    expect(screen.getByText(/18/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
npx vitest run src/lib/components/dashboard/__tests__/ThrottleBadge.test.js
```

- [ ] **Step 3: Implement the component**

Create `src/lib/components/dashboard/ThrottleBadge.svelte`:
```svelte
<script>
  import { _ } from 'svelte-i18n'
  import { claims_target_store } from '../../stores/claims_target.js'
  import { EvseClients } from '../../vars.js'
  import Icon from '../../icons/Icon.svelte'

  let active = $derived(
    $claims_target_store?.claims?.charge_current === EvseClients.tempThrottle.id,
  )
  let current = $derived($claims_target_store?.properties?.charge_current)
</script>

{#if active}
  <div class="mt-2 flex justify-center">
    <div
      role="status"
      class="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning"
    >
      <Icon icon="mdi:thermometer-alert" size={14} />
      <span>{$_('dashboard.throttle.active', { values: { amps: current } })}</span>
    </div>
  </div>
{/if}
```

- [ ] **Step 4: Run tests (expect PASS)**

```bash
npx vitest run src/lib/components/dashboard/__tests__/ThrottleBadge.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/dashboard/ThrottleBadge.svelte src/lib/components/dashboard/__tests__/ThrottleBadge.test.js
git commit -m "dashboard: ThrottleBadge — visible when temp-throttle claim is active"
```

---

## Task 12: Render ThrottleBadge on Dashboard

**Files:**
- Modify: `src/routes/Dashboard.svelte`

- [ ] **Step 1: Add the import + render**

Edit `src/routes/Dashboard.svelte`. Add to the imports block, grouped with the other dashboard components (right after the `PowerRing` import around line 21):
```javascript
import ThrottleBadge from '../lib/components/dashboard/ThrottleBadge.svelte'
```

Render the badge between `PowerRing` and `StatChips` (around line 288 in the existing file). Replace:
```svelte
  />

  <StatChips {charging} {live} {summary} {sessionCost} />
```
with:
```svelte
  />

  <ThrottleBadge />

  <StatChips {charging} {live} {summary} {sessionCost} />
```

The badge owns its own wrapper (Task 11 step 3) — the outer `{#if active}` ensures **no** DOM is emitted when the throttle claim is inactive, so no stray margin or empty row appears on a normal Dashboard.

The Task 11 component already wraps itself in a centered row that emits no DOM when `active` is false, so dropping it into Dashboard requires no further changes.

- [ ] **Step 2: Verify visually in dev:mock**

```bash
npm run build
```
Expected: clean build. Visual verification on real hardware deferred to Task 15.

- [ ] **Step 3: Commit**

```bash
git add src/routes/Dashboard.svelte
git commit -m "dashboard: render ThrottleBadge under the power ring"
```

---

## Task 13: Temp throttle section in Safety settings

**Files:**
- Modify: `src/routes/settings/Safety.svelte`
- Create: `src/routes/settings/__tests__/Safety-throttle.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/routes/settings/__tests__/Safety-throttle.test.js`:
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import { writable } from 'svelte/store'

const config = writable({
  gfci_check: true, ground_check: true, relay_check: true,
  temp_check: true, diode_check: true, vent_check: true,
  temp_throttle_enabled: false, temp_throttle_setpoint: 65,
})
const status = writable({ gfcicount: 0, nogndcount: 0, stuckcount: 0 })
const saveField = vi.fn(async () => true)

vi.mock('../../../lib/stores/config.js', () => ({ config_store: config }))
vi.mock('../../../lib/stores/status.js', () => ({ status_store: status }))
vi.mock('../../../lib/config/configForm.svelte.js', () => ({
  createConfigForm: () => ({ saveField, saveFields: vi.fn(), saveState: {}, revert: 0 }),
}))

import Safety from '../Safety.svelte'

describe('Safety — temp throttle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    config.set({
      gfci_check: true, ground_check: true, relay_check: true,
      temp_check: true, diode_check: true, vent_check: true,
      temp_throttle_enabled: false, temp_throttle_setpoint: 65,
    })
  })

  it('hides the setpoint slider when throttle is disabled', () => {
    render(Safety)
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('shows slider when throttle is enabled and commits via saveField', async () => {
    config.update((c) => ({ ...c, temp_throttle_enabled: true }))
    render(Safety)
    const slider = screen.getByRole('slider')
    expect(slider).toBeInTheDocument()
    await fireEvent.change(slider, { target: { value: '72' } })
    expect(saveField).toHaveBeenCalledWith('temp_throttle_setpoint', 72)
  })
})
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
npx vitest run src/routes/settings/__tests__/Safety-throttle.test.js
```

- [ ] **Step 3: Add the throttle section to Safety.svelte**

Edit `src/routes/settings/Safety.svelte`. Add imports for `Slider`:
```javascript
import Slider from '../../lib/components/ui/Slider.svelte'
```

Append a new `ConfigSection` after the existing `faults` section:
```svelte
<ConfigSection title={$_('config.safety.temp_throttle')}>
  <FormField label={$_('config.safety.temp_throttle_enable')} description={$_('config.safety.temp_throttle_desc')}>
    <Toggle
      checked={!!$config_store?.temp_throttle_enabled}
      label={$_('config.safety.temp_throttle_enable')}
      onchange={(v) => form.saveField('temp_throttle_enabled', v)}
    />
  </FormField>
  {#if $config_store?.temp_throttle_enabled}
    <FormField label={$_('config.safety.temp_throttle_setpoint')}>
      <div class="flex items-center gap-3">
        <Slider
          min={40}
          max={80}
          step={1}
          value={$config_store?.temp_throttle_setpoint ?? 65}
          onchange={(v) => form.saveField('temp_throttle_setpoint', v)}
        />
        <span class="w-12 text-right text-sm tabular-nums text-text">
          {$config_store?.temp_throttle_setpoint ?? 65}°C
        </span>
      </div>
    </FormField>
  {/if}
</ConfigSection>
```

- [ ] **Step 4: Run tests (expect PASS)**

```bash
npx vitest run src/routes/settings/__tests__/Safety-throttle.test.js
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/settings/Safety.svelte src/routes/settings/__tests__/Safety-throttle.test.js
git commit -m "settings/safety: temp throttle enable + 40–80°C setpoint"
```

---

## Task 14: English i18n keys

**Files:**
- Modify: `src/lib/i18n/en.json`

All new keys land in the English locale first. Task 15 mirrors them to the other three.

- [ ] **Step 1: Add the keys to en.json**

Add (or merge into existing nested groups) in `src/lib/i18n/en.json`:
```json
{
  "monitoring": {
    "tab": { "energy": "Energy" },
    "energy": {
      "live": "Live",
      "daily": "Daily",
      "monthly": "Monthly",
      "annual": "Annual",
      "older": "← Older",
      "current": "Current →",
      "no_older": "No earlier data",
      "historical": "Historical view",
      "latest_samples": "Latest {n} samples",
      "loading": "Loading…",
      "error": "Failed to load energy data",
      "no_samples": "No samples recorded yet",
      "axis": { "current": "Current (A)", "temperature": "Temperature (°C)", "energy": "Energy (Wh)" }
    }
  },
  "config": {
    "safety": {
      "temp_throttle": "Temperature throttle",
      "temp_throttle_enable": "Enable temperature throttle",
      "temp_throttle_setpoint": "Setpoint",
      "temp_throttle_desc": "Reduce charge current automatically when the EVSE reaches the setpoint temperature."
    }
  },
  "dashboard": {
    "throttle": { "active": "Throttled · {amps} A", "detail": "Temperature throttle is reducing the charge current." }
  }
}
```

(Merge — don't overwrite — into the existing object structure.)

- [ ] **Step 2: Run the locale parity test (expect FAIL until Task 15 mirrors keys)**

```bash
npx vitest run src/lib/i18n/__tests__/locale-parity.test.js
```
Expected: failure listing missing keys in es/fr/hu.

- [ ] **Step 3: Run only the en-loaded test (expect PASS)**

```bash
npx vitest run src/lib/i18n/__tests__/i18n.test.js
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/en.json
git commit -m "i18n(en): add energy / throttle keys"
```

---

## Task 15: Mirror keys to es / fr / hu and verify end-to-end

**Files:**
- Modify: `src/lib/i18n/es.json`
- Modify: `src/lib/i18n/fr.json`
- Modify: `src/lib/i18n/hu.json`

- [ ] **Step 1: Add Spanish translations**

Merge into `src/lib/i18n/es.json`:
```json
{
  "monitoring": {
    "tab": { "energy": "Energía" },
    "energy": {
      "live": "En vivo",
      "daily": "Diario",
      "monthly": "Mensual",
      "annual": "Anual",
      "older": "← Anterior",
      "current": "Actual →",
      "no_older": "No hay datos anteriores",
      "historical": "Vista histórica",
      "latest_samples": "Últimas {n} muestras",
      "loading": "Cargando…",
      "error": "No se pudieron cargar los datos de energía",
      "no_samples": "Aún no hay muestras registradas",
      "axis": { "current": "Corriente (A)", "temperature": "Temperatura (°C)", "energy": "Energía (Wh)" }
    }
  },
  "config": {
    "safety": {
      "temp_throttle": "Reducción por temperatura",
      "temp_throttle_enable": "Activar reducción por temperatura",
      "temp_throttle_setpoint": "Punto de consigna",
      "temp_throttle_desc": "Reduce automáticamente la corriente de carga cuando el EVSE alcanza la temperatura indicada."
    }
  },
  "dashboard": {
    "throttle": { "active": "Limitado · {amps} A", "detail": "La reducción por temperatura está bajando la corriente de carga." }
  }
}
```

- [ ] **Step 2: Add French translations**

Merge into `src/lib/i18n/fr.json`:
```json
{
  "monitoring": {
    "tab": { "energy": "Énergie" },
    "energy": {
      "live": "En direct",
      "daily": "Journalier",
      "monthly": "Mensuel",
      "annual": "Annuel",
      "older": "← Précédent",
      "current": "Actuel →",
      "no_older": "Aucune donnée antérieure",
      "historical": "Vue historique",
      "latest_samples": "Derniers {n} échantillons",
      "loading": "Chargement…",
      "error": "Échec du chargement des données d'énergie",
      "no_samples": "Aucun échantillon enregistré",
      "axis": { "current": "Courant (A)", "temperature": "Température (°C)", "energy": "Énergie (Wh)" }
    }
  },
  "config": {
    "safety": {
      "temp_throttle": "Limitation thermique",
      "temp_throttle_enable": "Activer la limitation thermique",
      "temp_throttle_setpoint": "Seuil",
      "temp_throttle_desc": "Réduit automatiquement le courant de charge lorsque l'EVSE atteint la température définie."
    }
  },
  "dashboard": {
    "throttle": { "active": "Bridé · {amps} A", "detail": "La limitation thermique réduit le courant de charge." }
  }
}
```

- [ ] **Step 3: Add Hungarian translations**

Merge into `src/lib/i18n/hu.json`:
```json
{
  "monitoring": {
    "tab": { "energy": "Energia" },
    "energy": {
      "live": "Élő",
      "daily": "Napi",
      "monthly": "Havi",
      "annual": "Éves",
      "older": "← Korábbi",
      "current": "Jelenlegi →",
      "no_older": "Nincs korábbi adat",
      "historical": "Korábbi nézet",
      "latest_samples": "Utolsó {n} minta",
      "loading": "Betöltés…",
      "error": "Nem sikerült betölteni az energia adatokat",
      "no_samples": "Még nincs rögzített minta",
      "axis": { "current": "Áram (A)", "temperature": "Hőmérséklet (°C)", "energy": "Energia (Wh)" }
    }
  },
  "config": {
    "safety": {
      "temp_throttle": "Hőmérséklet-szabályozás",
      "temp_throttle_enable": "Hőmérséklet-szabályozás bekapcsolása",
      "temp_throttle_setpoint": "Beállított érték",
      "temp_throttle_desc": "Automatikusan csökkenti a töltőáramot, ha az EVSE eléri a beállított hőmérsékletet."
    }
  },
  "dashboard": {
    "throttle": { "active": "Korlátozva · {amps} A", "detail": "A hőmérséklet-szabályozás csökkenti a töltőáramot." }
  }
}
```

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```
Expected: all green, including `locale-parity.test.js`.

- [ ] **Step 5: Smoke-verify in the browser**

```bash
npm run dev:mock &
sleep 3
echo "Open http://localhost:5173/#/monitoring → click Energy tab → verify chart renders"
echo "Open http://localhost:5173/#/settings/safety → toggle Temperature throttle → verify slider"
# kill %1 when done
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n/es.json src/lib/i18n/fr.json src/lib/i18n/hu.json
git commit -m "i18n: mirror energy / throttle keys to es/fr/hu"
```

- [ ] **Step 7: Push the branch**

```bash
git push -u origin feat/energy-logging
```

---

## Wrap-up checklist

- [ ] `npm test` — all green
- [ ] `npm run build` — clean build with `dist/assets/charts-*.js` chunk present
- [ ] Visual check in `npm run dev:mock`: Monitoring → Energy tab shows chart with mock data; Safety → throttle toggle reveals slider; Dashboard renders cleanly (badge stays hidden until real hardware claim).
- [ ] Hardware verification deferred: requires firmware PR #1083 merged + flashed onto `10.75.1.144`. Re-test:
  - Live chart populates with real samples
  - "← Older" pages backward, "Current →" snaps forward, "No earlier data" appears at end
  - Daily/Monthly/Annual show data once accumulated
  - Heat the EVSE past the setpoint and verify ThrottleBadge appears with the throttled current
  - Toggle throttle off in Safety settings — badge disappears, charge resumes
