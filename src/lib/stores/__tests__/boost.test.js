import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({
  httpAPI: vi.fn()
}))

import { boost_store } from '../boost.js'
import { httpAPI } from '../../api/httpAPI.js'

describe('boost_store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    boost_store.reset()
  })

  it('should have all required methods', () => {
    expect(typeof boost_store.subscribe).toBe('function')
    expect(typeof boost_store.download).toBe('function')
    expect(typeof boost_store.upload).toBe('function')
    expect(typeof boost_store.remove).toBe('function')
    expect(typeof boost_store.reset).toBe('function')
  })

  it('should initialize with the idle model', () => {
    const state = get(boost_store)
    expect(state.type).toBe('none')
    expect(state.value).toBe(0)
  })

  it('should download an active boost', async () => {
    const active = { type: 'time', value: 3600, remaining: 2847, started: '2026-08-23T14:02:11Z' }
    httpAPI.mockResolvedValue(active)

    const result = await boost_store.download()
    expect(result).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('GET', '/boost')

    const state = get(boost_store)
    expect(state.type).toBe('time')
    expect(state.remaining).toBe(2847)
  })

  it('should treat the empty object (200, idle) as no boost', async () => {
    boost_store.set({ type: 'energy', value: 100, remaining: 40 })
    httpAPI.mockResolvedValue({})
    const result = await boost_store.download()
    expect(result).toBe(true)

    const state = get(boost_store)
    expect(state.type).toBe('none')
    expect(state.value).toBe(0)
  })

  it('should return false on download error (e.g. 404 on old firmware)', async () => {
    httpAPI.mockResolvedValue('error')
    const result = await boost_store.download()
    expect(result).toBe(false)
  })

  it('should return the parsed body from upload so 201/400/422 can be told apart', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const data = { type: 'energy', value: 100 }
    const res = await boost_store.upload(data)
    expect(res).toEqual({ msg: 'done' })
    expect(httpAPI).toHaveBeenCalledWith('POST', '/boost', JSON.stringify(data))

    httpAPI.mockResolvedValue({ msg: 'no vehicle data source for this boost type' })
    const res422 = await boost_store.upload({ type: 'soc', value: 80 })
    expect(res422.msg).toContain('vehicle data source')
  })

  it('should cancel a boost', async () => {
    boost_store.set({ type: 'time', value: 3600, remaining: 100 })
    httpAPI.mockResolvedValue({ msg: 'done' })
    const result = await boost_store.remove()
    expect(result).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('DELETE', '/boost')
    expect(get(boost_store).type).toBe('none')
  })

  it('should treat "no boost" (404) as an idempotent cancel success', async () => {
    boost_store.set({ type: 'time', value: 3600, remaining: 100 })
    httpAPI.mockResolvedValue({ msg: 'no boost' })
    const result = await boost_store.remove()
    expect(result).toBe(true)
    expect(get(boost_store).type).toBe('none')
  })

  it('should return false on remove failure', async () => {
    httpAPI.mockResolvedValue('error')
    const result = await boost_store.remove()
    expect(result).toBe(false)
  })

  it('should reset to the idle model', () => {
    boost_store.set({ type: 'soc', value: 80, remaining: 5 })
    expect(boost_store.reset()).toBe(true)
    const state = get(boost_store)
    expect(state.type).toBe('none')
    expect(state.value).toBe(0)
  })
})
