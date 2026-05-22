import { describe, it, expect } from 'vitest'
import {
  pageRange, logTypeIcon, logTypeTone, logStateInfo, logEnergyKwh, logTempC,
} from '../logs.js'

describe('pageRange', () => {
  it('lists every index from min to max inclusive', () => {
    expect(pageRange(1, 1)).toEqual([1])
    expect(pageRange(3, 6)).toEqual([3, 4, 5, 6])
  })
  it('returns [] for an inverted or invalid range', () => {
    expect(pageRange(6, 3)).toEqual([])
    expect(pageRange(undefined, 5)).toEqual([])
    expect(pageRange(1.5, 3)).toEqual([])
  })
})

describe('logTypeIcon / logTypeTone', () => {
  it('maps known types', () => {
    expect(logTypeIcon('warning')).toBe('mdi:alert')
    expect(logTypeTone('warning')).toBe('error')
    expect(logTypeTone('information')).toBe('info')
    expect(logTypeTone('notification')).toBe('info')
  })
  it('falls back for an unknown type', () => {
    expect(logTypeIcon('whatever')).toBe('mdi:circle-small')
    expect(logTypeTone('whatever')).toBe('muted')
  })
})

describe('logStateInfo', () => {
  it('maps EVSE state codes to an icon and tone', () => {
    expect(logStateInfo(3)).toEqual({ icon: 'mdi:flash', tone: 'charging' })
    expect(logStateInfo(1)).toEqual({ icon: 'mdi:car-off', tone: 'muted' })
    expect(logStateInfo(2).tone).toBe('ok')
    expect(logStateInfo(0).tone).toBe('info')
    expect(logStateInfo(255).tone).toBe('muted')
  })
  it('treats error codes 4..11 as the error tone', () => {
    expect(logStateInfo(8)).toEqual({ icon: 'mdi:shield-alert', tone: 'error' })
    expect(logStateInfo(4).tone).toBe('error')
    expect(logStateInfo(11).tone).toBe('error')
  })
  it('falls back for an unknown code', () => {
    expect(logStateInfo(99).tone).toBe('muted')
  })
})

describe('logEnergyKwh', () => {
  it('converts watt-hours to kWh at 1 decimal', () => {
    expect(logEnergyKwh({ energy: 7400 })).toBe(7.4)
    expect(logEnergyKwh({ energy: 0 })).toBe(0)
  })
  it('is 0 when energy is absent', () => {
    expect(logEnergyKwh({})).toBe(0)
    expect(logEnergyKwh(undefined)).toBe(0)
  })
})

describe('logTempC', () => {
  it('rounds the temperature to 1 decimal', () => {
    expect(logTempC({ temperature: 28.47 })).toBe(28.5)
  })
  it('is 0 when temperature is absent', () => {
    expect(logTempC({})).toBe(0)
  })
})
