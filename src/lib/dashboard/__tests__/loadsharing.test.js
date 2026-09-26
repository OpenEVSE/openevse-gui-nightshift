import { describe, it, expect } from 'vitest'
import { loadSharingView } from '../loadsharing.js'
import { EvseClients } from '../../vars.js'

const LS = EvseClients.loadsharing.id

const controllerConfig = {
  loadsharing_enabled: true,
  loadsharing_role: false,
  loadsharing_group_max_current: 48,
}
const memberConfig = {
  loadsharing_enabled: true,
  loadsharing_role: true,
  loadsharing_controller_host: 'openevse-bench32.local',
  loadsharing_failsafe_safe_current: 6,
}
const noClaim = { properties: {}, claims: { state: null } }
const claim = (amps) => ({ properties: { max_current: amps }, claims: { max_current: LS } })

describe('loadSharingView', () => {
  it('is null when load sharing is off', () => {
    expect(loadSharingView({ config: {}, status: {}, claimsTarget: noClaim, lsStatus: null, localMax: 32 })).toBeNull()
    expect(loadSharingView({ config: { loadsharing_enabled: false }, status: {}, claimsTarget: noClaim, lsStatus: null, localMax: 32 })).toBeNull()
  })

  it('reads as plain sharing when nothing is limited, counting the other chargers', () => {
    const v = loadSharingView({
      config: controllerConfig,
      status: { pilot: 32, loadsharing_joined_peers: [{}, {}, {}, {}], loadsharing_group_current_total: 24000 },
      claimsTarget: noClaim,
      lsStatus: { failsafe_active: false, online_count: 3 },
      localMax: 32,
    })
    expect(v.state).toBe('sharing')
    expect(v.role).toBe('controller')
    expect(v.others).toBe(3)
    expect(v.groupTotal).toBe(24)
    expect(v.groupMax).toBe(48)
    expect(v.limit).toBeNull()
  })

  it('falls back to the online count when /status has no peer list', () => {
    const v = loadSharingView({
      config: controllerConfig, status: { pilot: 32 }, claimsTarget: noClaim,
      lsStatus: { online_count: 2 }, localMax: 32,
    })
    expect(v.others).toBe(2)
  })

  it('is limited when the load-sharing claim caps max_current below the local max', () => {
    const v = loadSharingView({
      config: controllerConfig, status: { pilot: 16 }, claimsTarget: claim(16),
      lsStatus: { failsafe_active: false }, localMax: 32,
    })
    expect(v.state).toBe('limited')
    expect(v.limit).toBe(16)
  })

  it('is not limited when the claim equals or exceeds the local max, or belongs to someone else', () => {
    const at = loadSharingView({ config: controllerConfig, status: {}, claimsTarget: claim(32), lsStatus: null, localMax: 32 })
    expect(at.state).toBe('sharing')
    const other = loadSharingView({
      config: controllerConfig, status: {},
      claimsTarget: { properties: { max_current: 10 }, claims: { max_current: EvseClients.ocpp.id } },
      lsStatus: null, localMax: 32,
    })
    expect(other.state).toBe('sharing')
    expect(other.limit).toBeNull()
  })

  it('reports failsafe from the firmware verdict, not from the claim', () => {
    // The 6 A failsafe claim is byte-for-byte the same claim an allocation
    // makes; only failsafe_active tells them apart.
    const v = loadSharingView({
      config: memberConfig, status: { pilot: 6, uptime: 8000 }, claimsTarget: claim(6),
      lsStatus: {
        failsafe_active: true,
        peers: [{ host: 'openevse-bench32.local', online: false, last_seen: 80 }],
      },
      localMax: 32,
    })
    expect(v.state).toBe('failsafe')
    expect(v.controller).toBe('openevse-bench32.local')
    expect(v.safeLimit).toBe(6)
    expect(v.unreachableFor).toBe(7920)
    expect(v.limit).toBe(6)
  })

  it('leaves unreachableFor null when the controller has never answered', () => {
    const never = loadSharingView({
      config: memberConfig, status: { uptime: 8000 }, claimsTarget: claim(6),
      lsStatus: { failsafe_active: true, peers: [] }, localMax: 32,
    })
    expect(never.state).toBe('failsafe')
    expect(never.unreachableFor).toBeNull()
    const zero = loadSharingView({
      config: memberConfig, status: { uptime: 8000 }, claimsTarget: claim(6),
      lsStatus: { failsafe_active: true, peers: [{ host: 'openevse-bench32.local', last_seen: 0 }] }, localMax: 32,
    })
    expect(zero.unreachableFor).toBeNull()
  })

  it('never calls a controller failsafe, and a member with a healthy controller is just limited', () => {
    const ctl = loadSharingView({
      config: controllerConfig, status: {}, claimsTarget: claim(6),
      lsStatus: { failsafe_active: true }, localMax: 32,
    })
    expect(ctl.state).toBe('limited')
    const mem = loadSharingView({
      config: memberConfig, status: {}, claimsTarget: claim(16),
      lsStatus: { failsafe_active: false }, localMax: 32,
    })
    expect(mem.state).toBe('limited')
  })

  it('falls back through the soft max when the dashboard ceiling is 0 (max_current_hard unset)', () => {
    const v = loadSharingView({
      config: { ...controllerConfig, max_current_soft: 32 }, status: { pilot: 16 }, claimsTarget: claim(16),
      lsStatus: null, localMax: 0,
    })
    expect(v.state).toBe('limited')
    expect(v.localMax).toBe(32)
    const none = loadSharingView({
      config: controllerConfig, status: { pilot: 16, max_current: 0 }, claimsTarget: claim(16),
      lsStatus: null, localMax: 0,
    })
    // No ceiling anywhere: an allocation is still a limit, and the bar is full.
    expect(none.state).toBe('limited')
    expect(none.localMax).toBe(16)
  })

  it('is only "sharing" on a member before /loadsharing/status has arrived', () => {
    // No verdict yet: do not guess failsafe from the claim.
    const v = loadSharingView({ config: memberConfig, status: {}, claimsTarget: claim(6), lsStatus: null, localMax: 32 })
    expect(v.state).toBe('limited')
  })
})
