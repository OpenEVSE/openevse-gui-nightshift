// src/lib/config/__tests__/validate.test.js
import { describe, it, expect } from 'vitest'
import { isRequired, inRange, isPort, isHostname, isDummyPassword } from '../validate.js'

describe('isRequired', () => {
  it('fails on empty / whitespace / null / undefined', () => {
    for (const v of ['', '   ', null, undefined]) {
      expect(isRequired(v).ok).toBe(false)
      expect(isRequired(v).msgKey).toBe('config.validation.required')
    }
  })
  it('passes on a non-empty value', () => {
    expect(isRequired('x')).toEqual({ ok: true, msgKey: null })
    expect(isRequired(0).ok).toBe(true)
  })
})

describe('inRange', () => {
  it('passes inside the range, inclusive', () => {
    expect(inRange(5, 0, 10).ok).toBe(true)
    expect(inRange(0, 0, 10).ok).toBe(true)
    expect(inRange(10, 0, 10).ok).toBe(true)
  })
  it('fails outside the range or on non-numbers', () => {
    expect(inRange(11, 0, 10).ok).toBe(false)
    expect(inRange(-1, 0, 10).ok).toBe(false)
    expect(inRange('abc', 0, 10).ok).toBe(false)
    expect(inRange(5, 0, 10).msgKey).toBe(null)
    expect(inRange(11, 0, 10).msgKey).toBe('config.validation.range')
  })
})

describe('isPort', () => {
  it('passes on 1..65535 integers', () => {
    expect(isPort(1883).ok).toBe(true)
    expect(isPort('80').ok).toBe(true)
  })
  it('fails on out-of-range or non-integers', () => {
    expect(isPort(0).ok).toBe(false)
    expect(isPort(70000).ok).toBe(false)
    expect(isPort(12.5).ok).toBe(false)
    expect(isPort(70000).msgKey).toBe('config.validation.port')
  })
})

describe('isHostname', () => {
  it('passes on plain hostnames', () => {
    expect(isHostname('openevse').ok).toBe(true)
    expect(isHostname('pool.ntp.org').ok).toBe(true)
  })
  it('fails on empty or illegal characters', () => {
    expect(isHostname('').ok).toBe(false)
    expect(isHostname('bad host!').ok).toBe(false)
    expect(isHostname('bad host!').msgKey).toBe('config.validation.hostname')
  })
})

describe('isDummyPassword', () => {
  it('recognises the device password sentinels', () => {
    expect(isDummyPassword('_DUMMY_PASSWORD')).toBe(true)
    expect(isDummyPassword('••••••••••')).toBe(true)
  })
  it('is false for a real value', () => {
    expect(isDummyPassword('hunter2')).toBe(false)
    expect(isDummyPassword('')).toBe(false)
  })
})
