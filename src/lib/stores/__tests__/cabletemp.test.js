import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({
  httpAPI: vi.fn()
}))

import { cabletemp_store } from '../cabletemp.js'
import { httpAPI } from '../../api/httpAPI.js'

const RESPONSE = {
  supported: true,
  enabled: true,
  sources: [
    { source: 0, name: 'ev1', pin: 1, status: 0, temperature: 34.5 },
    { source: 1, name: 'ev2', pin: 0, status: 1 },
    { source: 2, name: 'in1', pin: 0, status: 1 },
    { source: 3, name: 'in2', pin: 0, status: 1 },
  ],
}

describe('cabletemp_store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cabletemp_store.set(null)
  })

  it('downloads /cabletemp and replaces the store on a well-shaped response', async () => {
    httpAPI.mockResolvedValue(RESPONSE)
    const result = await cabletemp_store.download()
    expect(result).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('GET', '/cabletemp')
    expect(get(cabletemp_store)).toEqual(RESPONSE)
  })

  it('returns false and leaves the store alone on an error response', async () => {
    cabletemp_store.set(RESPONSE)
    httpAPI.mockResolvedValue('error')
    const result = await cabletemp_store.download()
    expect(result).toBe(false)
    expect(get(cabletemp_store)).toEqual(RESPONSE)
  })

  it('returns false when the response has no sources array (guards against a stale/wrong endpoint)', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const result = await cabletemp_store.download()
    expect(result).toBe(false)
  })

  it('uploads a pin/source change to /cabletemp', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const result = await cabletemp_store.upload({ source: 0, pin: 1 })
    expect(result).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/cabletemp', JSON.stringify({ source: 0, pin: 1 }))
  })

  it('returns false when the upload is rejected', async () => {
    httpAPI.mockResolvedValue({ msg: 'error' })
    const result = await cabletemp_store.upload({ source: 0, pin: 1 })
    expect(result).toBe(false)
  })
})
