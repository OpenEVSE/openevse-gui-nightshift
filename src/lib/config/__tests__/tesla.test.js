// src/lib/config/__tests__/tesla.test.js
import { describe, it, expect } from 'vitest'
import { hasTeslaCredentials } from '../tesla.js'

describe('hasTeslaCredentials', () => {
  const full = {
    tesla_access_token: 'a', tesla_refresh_token: 'r',
    tesla_created_at: 1700000000, tesla_expires_in: 3600,
  }
  it('is true when all four credential fields are present', () => {
    expect(hasTeslaCredentials(full)).toBe(true)
  })
  it('is false when any field is empty / zero / missing', () => {
    expect(hasTeslaCredentials({ ...full, tesla_access_token: '' })).toBe(false)
    expect(hasTeslaCredentials({ ...full, tesla_expires_in: 0 })).toBe(false)
    expect(hasTeslaCredentials({ ...full, tesla_refresh_token: false })).toBe(false)
    expect(hasTeslaCredentials({})).toBe(false)
    expect(hasTeslaCredentials(undefined)).toBe(false)
  })
})
