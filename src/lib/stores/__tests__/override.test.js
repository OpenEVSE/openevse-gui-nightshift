import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({
  httpAPI: vi.fn()
}))

vi.mock('../status.js', () => ({
  status_store: {
    subscribe: vi.fn(),
    set: vi.fn(),
    update: vi.fn()
  }
}))

import { override_store } from '../override.js'
import { httpAPI } from '../../api/httpAPI.js'

describe('override_store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    override_store.set(undefined)
  })

  it('should have all required methods', () => {
    expect(typeof override_store.subscribe).toBe('function')
    expect(typeof override_store.download).toBe('function')
    expect(typeof override_store.upload).toBe('function')
    expect(typeof override_store.clear).toBe('function')
    expect(typeof override_store.toggle).toBe('function')
    expect(typeof override_store.removeProp).toBe('function')
  })

  it('should download override data', async () => {
    const mockOverride = { state: 'active', charge_current: 24, auto_release: true }
    httpAPI.mockResolvedValue(mockOverride)

    const result = await override_store.download()
    expect(result).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('GET', '/override')

    const state = get(override_store)
    expect(state.charge_current).toBe(24)
  })

  it('should handle "no manual override" message', async () => {
    httpAPI.mockResolvedValue({ msg: 'No manual override' })

    const result = await override_store.download()
    expect(result).toBe(true)

    const state = get(override_store)
    expect(state).toEqual({})
  })

  it('should return false on download error', async () => {
    httpAPI.mockResolvedValue({ msg: 'error' })
    const result = await override_store.download()
    expect(result).toBe(false)
  })

  it('should upload override data', async () => {
    const data = { state: 'active', charge_current: 32 }
    httpAPI.mockResolvedValue({ msg: 'done' })

    await override_store.upload(data)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/override', JSON.stringify(data))

    const state = get(override_store)
    expect(state.charge_current).toBe(32)
  })

  it('returns false and leaves the store unchanged when the upload request fails', async () => {
    override_store.set({ state: 'active', charge_current: 10 })
    httpAPI.mockResolvedValue('error')

    const result = await override_store.upload({ state: 'disabled', charge_current: 32 })
    expect(result).toBe(false)
    expect(get(override_store).charge_current).toBe(10)
  })

  it('returns true on a successful upload', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const result = await override_store.upload({ charge_current: 20 })
    expect(result).toBe(true)
  })

  it('should toggle override', async () => {
    httpAPI.mockResolvedValue({ msg: 'Updated' })
    const result = await override_store.toggle()
    expect(result).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('PATCH', '/override')
  })

  it('should return false on toggle failure', async () => {
    httpAPI.mockResolvedValue({ msg: 'error' })
    const result = await override_store.toggle()
    expect(result).toBe(false)
  })
})
