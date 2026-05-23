// src/lib/__tests__/temperature.test.js
import { describe, it, expect } from 'vitest'
import { cToF, roundC, formatTemp } from '../temperature.js'

describe('cToF', () => {
  it('converts known reference points', () => {
    expect(cToF(0)).toBe(32)
    expect(cToF(100)).toBe(212)
    expect(cToF(-40)).toBe(-40)
  })
  it('rounds to 1 decimal', () => {
    expect(cToF(25)).toBe(77)
    expect(cToF(36.6)).toBe(97.9)
  })
  it('returns null for non-numeric input', () => {
    expect(cToF(null)).toBeNull()
    expect(cToF(undefined)).toBeNull()
    expect(cToF(NaN)).toBeNull()
    expect(cToF('not-a-number')).toBeNull()
  })
})

describe('roundC', () => {
  it('rounds to 1 dp', () => {
    expect(roundC(25.46)).toBe(25.5)
    expect(roundC(25.44)).toBe(25.4)
  })
  it('returns null for non-numeric input', () => {
    expect(roundC(null)).toBeNull()
    expect(roundC(undefined)).toBeNull()
    expect(roundC(NaN)).toBeNull()
  })
})

describe('formatTemp', () => {
  it('defaults to celsius unit key', () => {
    const r = formatTemp(25, undefined)
    expect(r).toEqual({ value: 25, unitKey: 'units.celsius' })
  })
  it('converts to fahrenheit when asked', () => {
    expect(formatTemp(0, 'f')).toEqual({ value: 32, unitKey: 'units.fahrenheit' })
    expect(formatTemp(100, 'f')).toEqual({ value: 212, unitKey: 'units.fahrenheit' })
  })
  it('returns null value but correct unit key when input is missing', () => {
    expect(formatTemp(null, 'c')).toEqual({ value: null, unitKey: 'units.celsius' })
    expect(formatTemp(null, 'f')).toEqual({ value: null, unitKey: 'units.fahrenheit' })
  })
})
