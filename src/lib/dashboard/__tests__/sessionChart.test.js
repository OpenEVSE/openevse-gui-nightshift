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
  it('returns kW = amps * volts / 1000 (single phase by default)', () => {
    expect(sampleKw({ a: 32 }, 240)).toBeCloseTo(7.68)
    expect(sampleKw({ a: 32 }, 240, 1)).toBeCloseTo(7.68)
  })
  it('multiplies by the phase count on a 3-phase device', () => {
    // The firmware reports per-phase amps; total power is amps * volts * phases.
    expect(sampleKw({ a: 32 }, 240, 3)).toBeCloseTo(23.04)
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
  it('triples the kW values when given 3 phases', () => {
    const samples = [S(1000, 32, 50), S(1300, 16, -1)]
    const [, , kw] = toChartData(samples, 240, 3)
    expect(kw[0]).toBeCloseTo(23.04)
    expect(kw[1]).toBeCloseTo(11.52)
  })
})

describe('kwAxisMax', () => {
  it('floors at 4', () => {
    expect(kwAxisMax([1, 2, 3])).toBe(4)
  })
  it('uses peak + 1 headroom, ignoring nulls, rounded up', () => {
    expect(kwAxisMax([3, null, 9.2])).toBe(11)
  })
  it('returns 4 when there are no finite values', () => {
    expect(kwAxisMax([null, null])).toBe(4)
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
  it('promotes a value that rounds up to a full hour', () => {
    expect(fmtSessionTime(3570)).toBe('1h00') // 59.5 min rounds to 60 -> 1h00
  })
})

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
  it('labels the soc (left) and kW (right) value axes', () => {
    const o = buildSessionOpts({ theme, target: 80, kwMax: 8 })
    // axes: [x, soc, kw]
    expect(o.axes[1].label).toBe('SOC %')
    expect(o.axes[2].label).toBe('kW')
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
