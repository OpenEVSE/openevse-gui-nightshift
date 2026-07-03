import { describe, it, expect } from 'vitest'
import { routes, LEGACY_ROUTES } from '../routes.js'

describe('route table', () => {
  it('maps the four primary paths', () => {
    expect(routes['/']).toBeDefined()
    expect(routes['/schedule']).toBeDefined()
    expect(routes['/monitoring']).toBeDefined()
    expect(routes['/history']).toBeDefined()
  })
})

describe('legacy route aliases', () => {
  it('every alias points at a real route', () => {
    for (const [from, to] of Object.entries(LEGACY_ROUTES)) {
      expect(routes[to], `${from} -> ${to}`).toBeDefined()
    }
  })

  it('covers every old /configuration page, including the renames', () => {
    expect(LEGACY_ROUTES['/configuration/selfproduction']).toBe('/settings/solar')
    expect(LEGACY_ROUTES['/configuration/dev']).toBe('/settings/terminal')
    expect(LEGACY_ROUTES['/configuration/evse']).toBe('/settings/evse')
    expect(LEGACY_ROUTES['/configuration']).toBe('/settings')
    // The short-lived combined Security page reverted to Certificates
    expect(LEGACY_ROUTES['/settings/security']).toBe('/settings/certificates')
    expect(LEGACY_ROUTES['/configuration/certificates']).toBe('/settings/certificates')
    // 15 straight moves + 2 renames + the index + the security->certificates revert
    expect(Object.keys(LEGACY_ROUTES)).toHaveLength(19)
  })
})
