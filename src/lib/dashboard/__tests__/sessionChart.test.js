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
  it('promotes a value that rounds up to a full hour', () => {
    expect(fmtSessionTime(3570)).toBe('1h00') // 59.5 min rounds to 60 -> 1h00
  })
})
