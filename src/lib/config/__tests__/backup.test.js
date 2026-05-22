// src/lib/config/__tests__/backup.test.js
import { describe, it, expect } from 'vitest'
import { sanitizeConfig } from '../backup.js'

describe('sanitizeConfig', () => {
  it('drops device-identity and capability fields', () => {
    const out = sanitizeConfig({
      hostname: 'evse', firmware: '7.1', version: '5.0', espinfo: 'x',
      buildenv: 'b', build_env: 'b', evse_serial: '1', wifi_serial: '2',
      ssid: 'wifi', www_username: 'admin', protocol: '-', espflash: '4MB',
      mqtt_supported_protocols: ['mqtt'], http_supported_protocols: ['http'],
    })
    expect(out).toEqual({ hostname: 'evse' })
  })
  it('drops fields holding the dummy-password sentinel', () => {
    const out = sanitizeConfig({ hostname: 'evse', mqtt_pass: '_DUMMY_PASSWORD', mqtt_user: 'u' })
    expect(out).toEqual({ hostname: 'evse', mqtt_user: 'u' })
  })
  it('keeps ordinary settings and tolerates empty / missing input', () => {
    expect(sanitizeConfig({ divert_enabled: true })).toEqual({ divert_enabled: true })
    expect(sanitizeConfig({})).toEqual({})
    expect(sanitizeConfig(undefined)).toEqual({})
  })
})
