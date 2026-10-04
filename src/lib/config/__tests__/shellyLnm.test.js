import { describe, it, expect } from 'vitest'
import { dataAgeTone, formatDataAge, hasData, POWER_FIELDS, VOLTAGE_FIELDS } from '../shellyLnm.js'

describe('shellyLnm helpers', () => {
  it('offers 5 power and 4 voltage fields', () => {
    expect(POWER_FIELDS).toHaveLength(5)
    expect(VOLTAGE_FIELDS).toHaveLength(4)
  })
  it('treats UINT32_MAX and non-numbers as no data', () => {
    expect(hasData(0xffffffff)).toBe(false)
    expect(hasData(undefined)).toBe(false)
    expect(hasData(157)).toBe(true)
    expect(formatDataAge(0xffffffff)).toBeNull()
    expect(formatDataAge(157)).toBe('157 ms')
  })
  it('maps the age to a tone', () => {
    expect(dataAgeTone(1000)).toBe('ok')
    expect(dataAgeTone(5000)).toBe('ok')
    expect(dataAgeTone(5001)).toBe('warn')
    expect(dataAgeTone(10001)).toBe('error')
    expect(dataAgeTone(0xffffffff)).toBe('error')
  })
})
