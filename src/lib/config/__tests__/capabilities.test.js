// src/lib/config/__tests__/capabilities.test.js
import { describe, it, expect } from 'vitest'
import { blockedSettingsRoutes } from '../capabilities.js'

describe('blockedSettingsRoutes', () => {
  it('lists routes whose required field is absent', () => {
    const blocked = blockedSettingsRoutes({})
    expect(blocked).toContain('/settings/ocpp')
    expect(blocked).toContain('/settings/solar')
    expect(blocked).not.toContain('/settings/evse') // never gated
  })
  it('does not block a route whose field is present but falsy', () => {
    expect(blockedSettingsRoutes({ ocpp_enabled: false })).not.toContain('/settings/ocpp')
  })
  it('blocks certificates (a TLS/OCPP feature) when ocpp_enabled is absent', () => {
    expect(blockedSettingsRoutes({})).toContain('/settings/certificates')
  })
  it('unblocks certificates when ocpp_enabled is reported', () => {
    expect(blockedSettingsRoutes({ ocpp_enabled: false })).not.toContain('/settings/certificates')
  })
})
