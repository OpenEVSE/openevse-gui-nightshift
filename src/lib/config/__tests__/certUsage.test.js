// src/lib/config/__tests__/certUsage.test.js
import { describe, it, expect } from 'vitest'
import { certificateUsage, CERT_REFERENCES } from '../certUsage.js'

describe('certificateUsage', () => {
  it('names the connection whose config points at the certificate', () => {
    const config = { mqtt_certificate_id: '5e6f7a8b', cloud_certificate_id: '9c0d1e2f' }
    expect(certificateUsage(config, '5e6f7a8b')).toEqual(['mqtt'])
    expect(certificateUsage(config, '9c0d1e2f')).toEqual(['cloud'])
  })

  it('reports both when one certificate serves both connections', () => {
    const config = { mqtt_certificate_id: 'abc', cloud_certificate_id: 'abc' }
    expect(certificateUsage(config, 'abc')).toEqual(['mqtt', 'cloud'])
  })

  it('returns nothing for an unreferenced certificate', () => {
    expect(certificateUsage({ mqtt_certificate_id: '5e6f7a8b' }, '1a2b3c4d')).toEqual([])
  })

  it('does not match the empty id that means "no certificate"', () => {
    const config = { mqtt_certificate_id: '', cloud_certificate_id: '' }
    expect(certificateUsage(config, '')).toEqual([])
    expect(certificateUsage(config, null)).toEqual([])
  })

  it('compares ids as strings, so a numeric config value still matches', () => {
    expect(certificateUsage({ cloud_certificate_id: 42 }, '42')).toEqual(['cloud'])
    expect(certificateUsage({ cloud_certificate_id: '42' }, 42)).toEqual(['cloud'])
  })

  it('is safe on a config that has not loaded, or a build without the client', () => {
    expect(certificateUsage(null, '5e6f7a8b')).toEqual([])
    expect(certificateUsage({ mqtt_enabled: true }, '5e6f7a8b')).toEqual([])
  })

  it('keys usage on the config reference, never on the certificate name', () => {
    // How a provisioning tool names its certificates is its own business and
    // must not become UI behaviour here.
    expect(CERT_REFERENCES.map((r) => r.key)).toEqual([
      'mqtt_certificate_id',
      'cloud_certificate_id',
    ])
  })
})
