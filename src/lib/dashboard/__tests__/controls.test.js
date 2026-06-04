import { describe, it, expect } from 'vitest'
import { controlSegments, selectedSegment } from '../controls.js'

describe('controlSegments', () => {
  it('includes the eco segment when divert is enabled', () => {
    expect(controlSegments(true)).toEqual(['off', 'auto', 'eco', 'on'])
  })
  it('omits the eco segment when divert is disabled', () => {
    expect(controlSegments(false)).toEqual(['off', 'auto', 'on'])
  })
})

describe('selectedSegment', () => {
  it('returns "on" when the manual override is active (mode 1)', () => {
    expect(selectedSegment({ mode: 1, divertmode: 1, divertEnabled: true })).toBe('on')
  })
  it('returns "off" when the manual override is disabled (mode 2)', () => {
    expect(selectedSegment({ mode: 2, divertmode: 2, divertEnabled: true })).toBe('off')
  })
  it('returns "eco" in auto when divert is enabled and active', () => {
    expect(selectedSegment({ mode: 0, divertmode: 2, divertEnabled: true })).toBe('eco')
  })
  it('returns "auto" in auto when divert is inactive', () => {
    expect(selectedSegment({ mode: 0, divertmode: 1, divertEnabled: true })).toBe('auto')
  })
  it('never returns "eco" when divert is disabled, even if divertmode is 2', () => {
    expect(selectedSegment({ mode: 0, divertmode: 2, divertEnabled: false })).toBe('auto')
  })
  it('treats missing mode/divertmode as auto', () => {
    expect(selectedSegment({})).toBe('auto')
  })
})
