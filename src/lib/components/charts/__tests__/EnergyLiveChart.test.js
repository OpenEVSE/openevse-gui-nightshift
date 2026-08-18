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
import { config_store } from '../../../stores/config.js'

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

// The device always sends °C. Converting the samples but leaving the scale
// bounds or the legend label in °C would be worse than not converting at all,
// so all three are asserted together.
describe('EnergyLiveChart temperature unit', () => {
  const realMatchMedia = window.matchMedia
  const samples = [
    { ts: 1, a: 10, t: 25, e: 0, s: -1 },
    { ts: 2, a: 12, t: 30, e: 0, s: -1 },
  ]

  beforeEach(() => {
    ctor.mockClear()
    setViewport(false)
  })
  afterEach(() => {
    window.matchMedia = realMatchMedia
    config_store.set({})
  })

  it('plots Celsius unchanged by default', () => {
    config_store.set({})
    render(EnergyLiveChart, { props: { samples } })
    const opts = lastOpts()
    const data = ctor.mock.calls.at(-1)[1]
    expect(data[2]).toEqual([25, 30])
    expect(opts.scales.t.range).toEqual([-20, 80])
    expect(opts.series.find((s) => s?.scale === 't').label).toBe('units.celsius')
  })

  it('converts the series, the scale bounds and the label for Fahrenheit', () => {
    config_store.set({ temp_unit: 'f' })
    render(EnergyLiveChart, { props: { samples } })
    const opts = lastOpts()
    const data = ctor.mock.calls.at(-1)[1]
    expect(data[2]).toEqual([77, 86])
    expect(opts.scales.t.range).toEqual([-4, 176])
    expect(opts.series.find((s) => s?.scale === 't').label).toBe('units.fahrenheit')
  })

  it('keeps the no-reading sentinel on the raw Celsius value', () => {
    // `t <= 0` means "no sensor". In °F those readings are positive numbers,
    // so testing after conversion would plot them as real data.
    config_store.set({ temp_unit: 'f' })
    render(EnergyLiveChart, { props: { samples: [{ ts: 1, a: 0, t: 0, e: 0, s: -1 }] } })
    expect(ctor.mock.calls.at(-1)[1][2]).toEqual([null])
  })
})
