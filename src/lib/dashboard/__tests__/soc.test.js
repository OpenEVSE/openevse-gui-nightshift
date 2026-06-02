import { describe, it, expect } from 'vitest'
import { restingTarget, isCapped, effectiveStop, socBarSegments, hmsShort } from '../soc.js'

describe('restingTarget', () => {
  it('uses the vehicle limit when known', () => {
    expect(restingTarget(75)).toBe(75)
  })
  it('falls back to 80 when the vehicle limit is unknown', () => {
    expect(restingTarget(null)).toBe(80)
    expect(restingTarget(undefined)).toBe(80)
    expect(restingTarget(NaN)).toBe(80)
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
      .toEqual({ fillPct: 74, zoneEndPct: 80, hatchStartPct: 90, hatchEndPct: 80 })
  })
  it('clamps the zone to the vehicle limit when capped', () => {
    expect(socBarSegments({ soc: 74, target: 80, vehicleLimit: 75 }))
      .toEqual({ fillPct: 74, zoneEndPct: 75, hatchStartPct: 75, hatchEndPct: 80 })
  })
  it('never runs the zone below the current SOC', () => {
    expect(socBarSegments({ soc: 74, target: 60, vehicleLimit: 90 }).zoneEndPct).toBe(74)
  })
  it('clamps inputs to 0..100', () => {
    const s = socBarSegments({ soc: 120, target: -5, vehicleLimit: 200 })
    expect(s.fillPct).toBe(100)
    expect(s.hatchEndPct).toBe(0)
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
