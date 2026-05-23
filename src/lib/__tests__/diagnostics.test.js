// src/lib/__tests__/diagnostics.test.js
import { describe, it, expect } from 'vitest'
import { scrubSecrets, buildDiagnostics } from '../diagnostics.js'

describe('scrubSecrets', () => {
  it('redacts fields whose key looks like a secret', () => {
    const out = scrubSecrets({
      ssid: 'home',
      pass: 'hunter2',
      ap_pass: 'admin',
      mqtt_pass: 's3cret',
      ocpp_authkey: 'abc',
      tesla_access_token: 'xyz',
      api_key: '1234',
      open_secret: 'still hides',
      hostname: 'openevse',
    })
    expect(out.ssid).toBe('home')
    expect(out.hostname).toBe('openevse')
    expect(out.pass).toBe('***REDACTED***')
    expect(out.ap_pass).toBe('***REDACTED***')
    expect(out.mqtt_pass).toBe('***REDACTED***')
    expect(out.ocpp_authkey).toBe('***REDACTED***')
    expect(out.tesla_access_token).toBe('***REDACTED***')
    expect(out.api_key).toBe('***REDACTED***')
    expect(out.open_secret).toBe('***REDACTED***')
  })

  it('leaves empty / falsy secret values alone (nothing to leak)', () => {
    const out = scrubSecrets({ pass: '', mqtt_pass: null })
    expect(out.pass).toBe('')
    expect(out.mqtt_pass).toBeNull()
  })

  it('recurses into nested objects and arrays', () => {
    const out = scrubSecrets({
      nested: { mqtt_pass: 'shh', ok: 'visible' },
      list: [{ access_token: 'a' }, { fine: 'b' }],
    })
    expect(out.nested.mqtt_pass).toBe('***REDACTED***')
    expect(out.nested.ok).toBe('visible')
    expect(out.list[0].access_token).toBe('***REDACTED***')
    expect(out.list[1].fine).toBe('b')
  })

  it('passes through primitives and null unchanged', () => {
    expect(scrubSecrets(null)).toBeNull()
    expect(scrubSecrets(42)).toBe(42)
    expect(scrubSecrets('hello')).toBe('hello')
    expect(scrubSecrets(true)).toBe(true)
  })
})

describe('buildDiagnostics', () => {
  it('returns a snapshot with all expected top-level keys', () => {
    const snap = buildDiagnostics({ now: new Date('2026-05-23T10:00:00Z') })
    expect(snap.generated_at).toBe('2026-05-23T10:00:00.000Z')
    // Each store has its own key — presence matters more than the value here
    // (stores may be undefined in test isolation).
    for (const k of [
      'config', 'status', 'schedule', 'plan', 'override',
      'claims_target', 'limit', 'certificates', 'uistates',
      'uisettings', 'theme',
    ]) {
      expect(Object.hasOwn(snap, k)).toBe(true)
    }
  })
})
