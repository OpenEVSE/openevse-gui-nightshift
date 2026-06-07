import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

// Capture the opts uPlot is constructed with (uPlot itself is mocked out).
const ctor = vi.fn()
vi.mock('uplot', () => ({
  default: class MockUplot {
    constructor(opts, data, target) { ctor(opts, data, target) }
    setData() {}
    setSize() {}
    destroy() {}
  },
}))

import EnergyLiveChart from '../EnergyLiveChart.svelte'

const samplesWithSoc = [
  { ts: 1, a: 10, t: 250, e: 0, s: 40 },
  { ts: 2, a: 12, t: 260, e: 0, s: 42 },
]

const lastOpts = () => ctor.mock.calls.at(-1)[0]
const setViewport = (matches) => {
  window.matchMedia = () => ({ matches, addEventListener() {}, removeEventListener() {} })
}

describe('EnergyLiveChart SOC axis responsiveness', () => {
  const realMatchMedia = window.matchMedia
  beforeEach(() => ctor.mockClear())
  afterEach(() => { window.matchMedia = realMatchMedia })

  it('shows the SOC axis on wide screens', () => {
    setViewport(false)
    render(EnergyLiveChart, { props: { samples: samplesWithSoc } })
    const opts = lastOpts()
    expect(opts.series.some((s) => s?.scale === 'soc')).toBe(true)
    expect(opts.axes.some((a) => a?.scale === 'soc')).toBe(true)
  })

  it('drops the SOC axis but keeps the line and scale on narrow screens', () => {
    setViewport(true)
    render(EnergyLiveChart, { props: { samples: samplesWithSoc } })
    const opts = lastOpts()
    expect(opts.series.some((s) => s?.scale === 'soc')).toBe(true) // line kept
    expect(opts.axes.some((a) => a?.scale === 'soc')).toBe(false) // axis dropped
    expect(opts.scales.soc).toBeTruthy() // scale kept so the line still plots 0–100
  })
})
