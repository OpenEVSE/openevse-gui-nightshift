import { describe, it, expect } from 'vitest'
import {
  pageRange, logTypeIcon, logTypeTone, logStateInfo, logEnergyKwh, logTempC,
  logPilotAmps, logReason,
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

describe('logPilotAmps', () => {
  it('returns the pilot current as whole amps', () => {
    expect(logPilotAmps({ pilot: 47 })).toBe(47)
    expect(logPilotAmps({ pilot: 41.6 })).toBe(42)
  })
  it('is null when the pilot field is absent or non-finite', () => {
    expect(logPilotAmps({})).toBeNull()
    expect(logPilotAmps(undefined)).toBeNull()
    expect(logPilotAmps({ pilot: 'x' })).toBeNull()
  })
})

describe('logReason', () => {
  it('is null for a legacy entry with empty or missing changed', () => {
    expect(logReason({ changed: [], pilot: 47 }, { pilot: 40 })).toBeNull()
    expect(logReason({ pilot: 47 }, { pilot: 40 })).toBeNull()
  })

  it('reports periodic first and skips the delta path entirely', () => {
    // Invariant: the firmware sends ["periodic"] alone, but even if another
    // field looks changed the periodic branch must win with no params.
    expect(logReason({ changed: ['periodic'], pilot: 47 }, { pilot: 40 })).toEqual({
      code: 'periodic',
    })
  })

  it('renders the pilot transition, and wins over a co-changed state', () => {
    expect(logReason({ changed: ['state', 'pilot'], pilot: 42 }, { pilot: 47 })).toEqual({
      code: 'pilot',
      params: { from: 47, to: 42 },
    })
  })

  it('falls back to the current pilot when there is no predecessor', () => {
    expect(logReason({ changed: ['pilot'], pilot: 42 }, null)).toEqual({
      code: 'pilot_now',
      params: { to: 42 },
    })
  })

  it('names the charging-relay flag transition, not the raw bitmask', () => {
    // 1344 (0x540) → 1280 (0x500): the 0x40 relay bit clears.
    expect(logReason({ changed: ['flags'], evseFlags: 1280 }, { evseFlags: 1344 })).toEqual({
      code: 'flags_relay_opened',
    })
    expect(logReason({ changed: ['flags'], evseFlags: 1344 }, { evseFlags: 1280 })).toEqual({
      code: 'flags_relay_closed',
    })
  })

  it('names the vehicle-connected flag transition', () => {
    expect(logReason({ changed: ['flags'], evseFlags: 0x100 }, { evseFlags: 0 })).toEqual({
      code: 'flags_vehicle_connected',
    })
    expect(logReason({ changed: ['flags'], evseFlags: 0 }, { evseFlags: 0x100 })).toEqual({
      code: 'flags_vehicle_disconnected',
    })
  })

  it('is null for an unnamed flag bit or a missing predecessor', () => {
    expect(logReason({ changed: ['flags'], evseFlags: 0x1 }, { evseFlags: 0x0 })).toBeNull()
    expect(logReason({ changed: ['flags'], evseFlags: 0x100 }, null)).toBeNull()
  })

  it('suppresses reasons that merely restate the visible state label', () => {
    expect(logReason({ changed: ['state'] }, {})).toBeNull()
    expect(logReason({ changed: ['manager'] }, {})).toBeNull()
    expect(logReason({ changed: ['state', 'manager'] }, {})).toBeNull()
  })

  it('names divert and shaper transitions and reports a reboot', () => {
    expect(logReason({ changed: ['divert'], divertMode: 1 }, { divertMode: 0 })).toEqual({
      code: 'divert',
      params: { from: 0, to: 1 },
    })
    expect(logReason({ changed: ['shaper'], shaper: 2 }, { shaper: 0 })).toEqual({
      code: 'shaper',
      params: { from: 0, to: 2 },
    })
    expect(logReason({ changed: ['boot'] }, null)).toEqual({ code: 'boot' })
  })
})
