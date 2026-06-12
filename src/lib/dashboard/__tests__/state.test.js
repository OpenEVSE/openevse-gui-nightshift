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
  })
  it('treats state 254 with mode=Off (2) as off, not sleeping', () => {
    // The "Off" mode just drops charge_current to 0 — device sits in
    // sleeping (254). Without the mode hint, that's indistinguishable
    // from auto-waiting-on-a-timer.
    expect(displayState({ state: 254 }, 2)).toBe('off')
    expect(displayState({ state: 254 }, 0)).toBe('sleeping')
    expect(displayState({ state: 254 }, 1)).toBe('sleeping')
    // Same disambiguation for an unplugged-but-disabled device (state 1 + Off).
    expect(displayState({ state: 1 }, 2)).toBe('off')
    expect(displayState({ state: 1 }, 0)).toBe('idle')
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
  it('names the timer window when the scheduler holds the claim', () => {
    const plan = {
      current_event: { state: 'disabled', time: '06:25' },
      next_event: { state: 'active', time: '22:50' },
    }
    const r = connectedReason(0, plan, 'timer')
    expect(r.key).toBe('dashboard.reason.timer')
    expect(r.values).toEqual({ since: '06:25' })
    expect(r.detail).toEqual({ key: 'dashboard.reason.timer_on', values: { at: '22:50' } })
  })
  it('names an eco resume when the next timer event is eco', () => {
    const plan = {
      current_event: { state: 'disabled', time: '06:25' },
      next_event: { state: 'eco', time: '10:00' },
    }
    const r = connectedReason(0, plan, 'timer')
    expect(r.key).toBe('dashboard.reason.timer')
    expect(r.values).toEqual({ since: '06:25' })
    expect(r.detail).toEqual({ key: 'dashboard.reason.timer_eco', values: { at: '10:00' } })
  })
  it('trims seconds off plan event times', () => {
    // the device reports HH:MM:SS but schedules only resolve to the minute
    const plan = {
      current_event: { state: 'disabled', time: '14:00:00' },
      next_event: { state: 'active', time: '08:00:00' },
    }
    const r = connectedReason(0, plan, 'timer')
    expect(r.values).toEqual({ since: '14:00' })
    expect(r.detail.values).toEqual({ at: '08:00' })
    const w = connectedReason(0, { next_event: { time: '23:00:00' } })
    expect(w.values.time).toBe('23:00')
  })
  it('falls back to waiting when the timer claim has no current event', () => {
    const plan = { current_event: false, next_event: { state: 'active', time: '22:50' } }
    const r = connectedReason(0, plan, 'timer')
    expect(r.key).toBe('dashboard.reason.waiting')
    expect(r.values.time).toBe('22:50')
  })
  it('does not use the timer window when the next flip is a disable', () => {
    const plan = {
      current_event: { state: 'active', time: '22:50' },
      next_event: { state: 'disabled', time: '06:25' },
    }
    const r = connectedReason(0, plan, 'timer')
    expect(r.key).toBe('dashboard.reason.waiting')
  })
  it('names eco, ocpp and rfid claim owners', () => {
    expect(connectedReason(0, null, 'divert').key).toBe('dashboard.reason.eco_waiting')
    expect(connectedReason(0, null, 'ocpp').key).toBe('dashboard.reason.ocpp')
    expect(connectedReason(0, null, 'rfid').key).toBe('dashboard.reason.rfid')
  })
})
