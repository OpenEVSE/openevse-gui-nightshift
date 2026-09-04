import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))
vi.mock('../../queue.js', () => ({
  serialQueue: { add: vi.fn((fn) => fn()) },
}))

import { energy_store } from '../energy.js'
import { httpAPI } from '../../api/httpAPI.js'

describe('energy_store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    energy_store.reset()
  })

  it('starts empty', () => {
    const s = get(energy_store)
    expect(s.raw.samples).toEqual([])
    expect(s.raw.historical).toBe(false)
    expect(s.raw.noOlder).toBe(false)
    expect(s.loading.raw).toBe(false)
    expect(s.error.raw).toBe(false)
  })

  it('loadRaw() fetches /energy/raw and populates samples', async () => {
    httpAPI.mockResolvedValue({ samples: [{ ts: 1, a: 0, t: 33, e: 0 }] })
    const ok = await energy_store.loadRaw()
    expect(ok).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('GET', '/energy/raw')
    const s = get(energy_store)
    expect(s.raw.samples).toHaveLength(1)
    expect(s.raw.historical).toBe(false)
  })

  it('loadRaw(before) sets historical and uses the before param', async () => {
    httpAPI.mockResolvedValue({ samples: [{ ts: 1, a: 0, t: 33, e: 0 }] })
    await energy_store.loadRaw(12345)
    expect(httpAPI).toHaveBeenCalledWith('GET', '/energy/raw?before=12345')
    const s = get(energy_store)
    expect(s.raw.historical).toBe(true)
  })

  it('loadRaw(before) with empty response sets noOlder and keeps samples', async () => {
    httpAPI.mockResolvedValueOnce({ samples: [{ ts: 1, a: 0, t: 33, e: 0 }] })
    await energy_store.loadRaw()
    httpAPI.mockResolvedValueOnce({ samples: [] })
    await energy_store.loadRaw(1)
    const s = get(energy_store)
    expect(s.raw.noOlder).toBe(true)
    expect(s.raw.samples).toHaveLength(1)
  })

  it('loadRaw() sets error on httpAPI failure', async () => {
    httpAPI.mockResolvedValue('error')
    const ok = await energy_store.loadRaw()
    expect(ok).toBe(false)
    expect(get(energy_store).error.raw).toBe(true)
  })

  it('loadDaily / loadMonthly / loadAnnual fetch their endpoints', async () => {
    httpAPI.mockResolvedValue({ daily: [{ d: '2026-05-24', kwh: 12.3 }] })
    await energy_store.loadDaily()
    expect(httpAPI).toHaveBeenLastCalledWith('GET', '/energy/daily')

    httpAPI.mockResolvedValue({ monthly: [] })
    await energy_store.loadMonthly()
    expect(httpAPI).toHaveBeenLastCalledWith('GET', '/energy/monthly')

    httpAPI.mockResolvedValue({ annual: [] })
    await energy_store.loadAnnual()
    expect(httpAPI).toHaveBeenLastCalledWith('GET', '/energy/annual')
  })
  it('loadNewer() asks for the window ending 3h after the current anchor', async () => {
    httpAPI.mockResolvedValue({ samples: [{ ts: 1, a: 0, t: 33, e: 0 }] })
    await energy_store.loadRaw(1_000_000)
    httpAPI.mockClear()
    await energy_store.loadNewer()
    expect(httpAPI).toHaveBeenCalledWith('GET', '/energy/raw?before=1010800')
    expect(get(energy_store).raw.before).toBe(1_010_800)
  })

  it('loadNewer() snaps to the live view once the next window reaches now', async () => {
    httpAPI.mockResolvedValue({ samples: [{ ts: 1, a: 0, t: 33, e: 0 }] })
    const now = Math.floor(Date.now() / 1000)
    await energy_store.loadRaw(now - 3600)
    httpAPI.mockClear()
    await energy_store.loadNewer()
    expect(httpAPI).toHaveBeenCalledWith('GET', '/energy/raw')
    expect(get(energy_store).raw.historical).toBe(false)
  })

  it('loadNewer() into an empty gap keeps the samples and advances the anchor', async () => {
    httpAPI.mockResolvedValueOnce({ samples: [{ ts: 1, a: 0, t: 33, e: 0 }] })
    await energy_store.loadRaw(1_000_000)
    httpAPI.mockResolvedValueOnce({ samples: [] })
    await energy_store.loadNewer()
    const s = get(energy_store)
    expect(s.raw.samples).toHaveLength(1)
    expect(s.raw.noOlder).toBe(false)
    expect(s.raw.before).toBe(1_010_800)
  })

  it('loadNewer() with no anchor loads the live view', async () => {
    httpAPI.mockResolvedValue({ samples: [] })
    await energy_store.loadNewer()
    expect(httpAPI).toHaveBeenCalledWith('GET', '/energy/raw')
  })
})
