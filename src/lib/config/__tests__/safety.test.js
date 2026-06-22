import { describe, it, expect } from 'vitest'
import { allRequiredSafetyChecksOn, REQUIRED_SAFETY_CHECKS } from '../safety.js'

const ALL_REQUIRED = { ground_check: true, relay_check: true, diode_check: true, vent_check: true }

describe('allRequiredSafetyChecksOn', () => {
  it('is true when every required check is on', () => {
    expect(allRequiredSafetyChecksOn(ALL_REQUIRED)).toBe(true)
  })
  it('ignores GFCI self-test (optional)', () => {
    expect(allRequiredSafetyChecksOn({ ...ALL_REQUIRED, gfci_check: false })).toBe(true)
  })
  it('is false when a required check is off', () => {
    expect(allRequiredSafetyChecksOn({ ...ALL_REQUIRED, vent_check: false })).toBe(false)
  })
  it('handles missing config', () => {
    expect(allRequiredSafetyChecksOn(undefined)).toBe(false)
    expect(allRequiredSafetyChecksOn({})).toBe(false)
  })
  it('does not list gfci_check as required', () => {
    expect(REQUIRED_SAFETY_CHECKS).not.toContain('gfci_check')
  })
})
