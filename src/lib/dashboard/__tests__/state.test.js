import { describe, it, expect } from 'vitest'
import { displayState, ringFill, limitProgress, connectedReason } from '../state.js'

describe('displayState', () => {
  it('returns starting when status is missing or state 0', () => {
    expect(displayState(undefined)).toBe('starting')
    expect(displayState({})).toBe('starting')
    expect(displayState({ state: 0 })).toBe('starting')
  })
  it('maps EVSE state codes', () => {
    expect(displayState({ state: 1 })).toBe('idle')
    expect(displayState({ state: 2 })).toBe('connected')
    expect(displayState({ state: 254 })).toBe('sleeping')
    expect(displayState({ state: 255 })).toBe('off')
    expect(displayState({ state: 3 })).toBe('charging')
    expect(displayState({ state: 4 })).toBe('error')
    expect(displayState({ state: 9 })).toBe('error')
    expect(displayState({ state: 11 })).toBe('error')
  })
})

describe('ringFill', () => {
  it('is power over max power when charging with no limit', () => {
    // 7000 W / (40 A * 240 V = 9600 W) = 0.729
    expect(ringFill({ power: 7000, voltage: 240 }, { max_current_soft: 40 }, null)).toBeCloseTo(0.729, 2)
  })
  it('clamps to 0..1', () => {
    expect(ringFill({ power: 99999, voltage: 240 }, { max_current_soft: 40 }, null)).toBe(1)
    expect(ringFill({ power: -50, voltage: 240 }, { max_current_soft: 40 }, null)).toBe(0)
  })
  it('returns 0 when max power is unusable', () => {
    expect(ringFill({ power: 7000, voltage: 0 }, { max_current_soft: 0 }, null)).toBe(0)
  })
  it('uses limit progress when a limit is active', () => {
    const limit = { type: 'energy', value: 10000 }
    expect(ringFill({ power: 7000, voltage: 240, session_energy: 5000 }, { max_current_soft: 40 }, limit)).toBeCloseTo(0.5, 2)
  })
})

describe('limitProgress', () => {
  it('time limit: elapsed seconds over value-minutes', () => {
    expect(limitProgress({ type: 'time', value: 60 }, { session_elapsed: 1800 })).toBeCloseTo(0.5, 2)
  })
  it('energy limit: session_energy over value', () => {
    expect(limitProgress({ type: 'energy', value: 8000 }, { session_energy: 2000 })).toBeCloseTo(0.25, 2)
  })
  it('returns 0 for none/unknown or zero target', () => {
    expect(limitProgress({ type: 'none', value: 0 }, {})).toBe(0)
    expect(limitProgress({ type: 'time', value: 0 }, { session_elapsed: 100 })).toBe(0)
  })
})

describe('connectedReason', () => {
  it('waiting when a schedule event is pending', () => {
    const r = connectedReason(0, { next_event: { time: '23:00' } })
    expect(r.key).toBe('dashboard.reason.waiting')
    expect(r.values.time).toBe('23:00')
  })
  it('off when mode is Off', () => {
    expect(connectedReason(2, null).key).toBe('dashboard.reason.off')
  })
  it('generic not_charging otherwise', () => {
    expect(connectedReason(0, null).key).toBe('dashboard.reason.not_charging')
  })
})
