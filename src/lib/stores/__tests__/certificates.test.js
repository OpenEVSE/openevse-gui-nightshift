import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({
  httpAPI: vi.fn()
}))

import { certificate_store } from '../certificates.js'
import { httpAPI } from '../../api/httpAPI.js'

describe('certificate_store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    certificate_store.set([])
  })

  it('should have all required methods', () => {
    expect(typeof certificate_store.subscribe).toBe('function')
    expect(typeof certificate_store.download).toBe('function')
    expect(typeof certificate_store.upload).toBe('function')
    expect(typeof certificate_store.remove).toBe('function')
  })

  it('generates a self-signed certificate', async () => {
    httpAPI.mockResolvedValue({ msg: 'done', id: 'abc123' })

    const result = await certificate_store.generateSelfSigned()
    expect(httpAPI).toHaveBeenCalledWith('POST', '/certificates/self-signed')
    expect(result).toEqual({ success: true, id: 'abc123' })
  })

  it('passes the firmware message through when self-signing is unavailable', async () => {
    // Builds without mbedTLS answer 501 rather than generating a key.
    httpAPI.mockResolvedValue({
      msg: 'Self-signed certificate generation is not available in native builds.',
    })

    const result = await certificate_store.generateSelfSigned()
    expect(result.success).toBe(false)
    expect(result.msg).toContain('not available')
  })

  it('should download certificates', async () => {
    const mockCerts = [
      { id: 1, name: 'cert1' },
      { id: 2, name: 'cert2' }
    ]
    httpAPI.mockResolvedValue(mockCerts)

    const result = await certificate_store.download()
    expect(result).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('GET', '/certificates')

    const state = get(certificate_store)
    expect(state).toHaveLength(2)
    expect(state[0].name).toBe('cert1')
  })

  it('should return false on download error', async () => {
    httpAPI.mockResolvedValue('error')
    const result = await certificate_store.download()
    expect(result).toBe(false)
  })

  it('should upload certificate and return result with success flag', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const data = { name: 'newcert', pem: '...' }
    const result = await certificate_store.upload(data)
    expect(result.success).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/certificates', JSON.stringify(data))
  })

  it('should set success to false on upload failure', async () => {
    httpAPI.mockResolvedValue({ msg: 'error' })
    const result = await certificate_store.upload({})
    expect(result.success).toBe(false)
  })

  it('should remove certificate by id', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const result = await certificate_store.remove(1)
    expect(result).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('DELETE', '/certificates/1')
  })

  it('should return false on remove failure', async () => {
    httpAPI.mockResolvedValue({ msg: 'error' })
    const result = await certificate_store.remove(1)
    expect(result).toBe(false)
  })
})
