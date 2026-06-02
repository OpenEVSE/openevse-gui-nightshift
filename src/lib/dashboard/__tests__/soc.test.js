import { describe, it, expect } from 'vitest'
import { socCeiling, isCapped, effectiveStop, socBarSegments, hmsShort, estMaxRange } from '../soc.js'

describe('socCeiling', () => {
  it('uses the vehicle limit when known', () => {
    expect(socCeiling(75)).toBe(75)
  })
  it('falls back to 100 when the vehicle limit is unknown', () => {
    expect(socCeiling(null)).toBe(100)
    expect(socCeiling(undefined)).toBe(100)
    expect(socCeiling(NaN)).toBe(100)
  })
})

describe('isCapped', () => {
  it('is true only when the target is above a known vehicle limit', () => {
    expect(isCapped(80, 75)).toBe(true)
    expect(isCapped(75, 75)).toBe(false)
    expect(isCapped(70, 75)).toBe(false)
    expect(isCapped(80, null)).toBe(false)
  })
})

describe('effectiveStop', () => {
  it('is the lower of target and vehicle limit', () => {
    expect(effectiveStop(80, 75)).toBe(75)
    expect(effectiveStop(70, 75)).toBe(70)
  })
  it('is the target when the vehicle limit is unknown', () => {
    expect(effectiveStop(80, null)).toBe(80)
  })
})

describe('socBarSegments', () => {
  it('fills to SOC and runs the zone up to the effective stop', () => {
    expect(socBarSegments({ soc: 74, target: 80, vehicleLimit: 90 }))
      .toEqual({ fillPct: 74, zoneEndPct: 80 })
  })
  it('clamps the zone to the vehicle limit when the target is above it', () => {
    expect(socBarSegments({ soc: 74, target: 80, vehicleLimit: 75 }))
      .toEqual({ fillPct: 74, zoneEndPct: 75 })
  })
  it('never runs the zone below the current SOC', () => {
    expect(socBarSegments({ soc: 74, target: 60, vehicleLimit: 90 }).zoneEndPct).toBe(74)
  })
  it('clamps inputs to 0..100', () => {
    const s = socBarSegments({ soc: 120, target: -5, vehicleLimit: 200 })
    expect(s.fillPct).toBe(100)
    expect(s.zoneEndPct).toBe(100)
  })
})

describe('hmsShort', () => {
  it('formats hours and minutes', () => {
    expect(hmsShort(4500)).toBe('1h 15m')
  })
  it('formats minutes only under an hour', () => {
    expect(hmsShort(600)).toBe('10m')
  })
  it('rolls 60 rounded minutes up to the next hour', () => {
    expect(hmsShort(3570)).toBe('1h 0m')
  })
  it('returns empty for zero or invalid input', () => {
    expect(hmsShort(0)).toBe('')
    expect(hmsShort(-1)).toBe('')
    expect(hmsShort(NaN)).toBe('')
  })
})

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
