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

  it('strips `remaining` before POSTing — it is a read-only GET field', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const result = await override_store.upload({
      state: 'active',
      charge_current: 32,
      duration: 900,
      remaining: 842,
    })
    expect(result).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith(
      'POST',
      '/override',
      JSON.stringify({ state: 'active', charge_current: 32, duration: 900 }),
    )
    expect(get(override_store)).not.toHaveProperty('remaining')
  })

  it('clears the override on a successful DELETE', async () => {
    override_store.set({ state: 'active', charge_current: 32, auto_release: false })
    httpAPI.mockResolvedValue({ msg: 'done' })
    const result = await override_store.clear()
    expect(result).toBe(true)
    expect(get(override_store)).toEqual({})
  })

  it('treats a network-error DELETE as a failure, not a success (FIX C)', async () => {
    // httpAPI collapses a fetch/network failure to the literal string
    // "error" — that is truthy, so a naive `if (res)` check (the old code)
    // reads it as success and silently empties the store, hiding an active
    // boost's countdown while reporting the cancel worked.
    override_store.set({ state: 'active', charge_current: 32, auto_release: false, remaining: 120 })
    httpAPI.mockResolvedValue('error')
    const result = await override_store.clear()
    expect(result).toBe(false)
    expect(get(override_store)).toEqual({ state: 'active', charge_current: 32, auto_release: false, remaining: 120 })
  })

  it('treats a msg:"error" DELETE body as a failure', async () => {
    override_store.set({ state: 'active', charge_current: 32, auto_release: false })
    httpAPI.mockResolvedValue({ msg: 'error' })
    const result = await override_store.clear()
    expect(result).toBe(false)
  })

  it('returns false and does not clear when there was nothing to clear', async () => {
    override_store.set(undefined)
    const result = await override_store.clear()
    expect(result).toBe(false)
    expect(httpAPI).not.toHaveBeenCalled()
  })

  it('remainingBoostSeconds reads a live `remaining` from the store', () => {
    override_store.set({ state: 'active', charge_current: 32, auto_release: false, remaining: 120 })
    expect(override_store.remainingBoostSeconds()).toBeGreaterThan(0)
    expect(override_store.remainingBoostSeconds()).toBeLessThanOrEqual(120)
  })

  it('remainingBoostSeconds falls back to a just-uploaded `duration`', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    await override_store.upload({ state: 'active', charge_current: 32, auto_release: false, duration: 900 })
    expect(override_store.remainingBoostSeconds()).toBeGreaterThan(0)
    expect(override_store.remainingBoostSeconds()).toBeLessThanOrEqual(900)
  })

  it('remainingBoostSeconds is null with no active timer', () => {
    override_store.set({ state: 'active', charge_current: 32, auto_release: false })
    expect(override_store.remainingBoostSeconds()).toBeNull()
    override_store.set({})
    expect(override_store.remainingBoostSeconds()).toBeNull()
  })

  it('preserveBoostDuration injects the live remaining seconds and strips remaining/duration inputs', () => {
    override_store.set({ state: 'active', charge_current: 32, auto_release: false, remaining: 300 })
    const out = override_store.preserveBoostDuration({
      state: 'active',
      charge_current: 20,
      auto_release: false,
      duration: 999999, // a stale/bogus caller-supplied value must be ignored
      remaining: 5, // must never be forwarded
    })
    expect(out.charge_current).toBe(20)
    expect(out).not.toHaveProperty('remaining')
    expect(out.duration).toBeGreaterThan(0)
    expect(out.duration).toBeLessThanOrEqual(300)
  })

  it('preserveBoostDuration is a no-op (minus remaining) when no boost is active', () => {
    override_store.set({ state: 'active', charge_current: 32, auto_release: false })
    const out = override_store.preserveBoostDuration({ state: 'active', charge_current: 20, auto_release: false })
    expect(out).toEqual({ state: 'active', charge_current: 20, auto_release: false })
  })

  it('removeProp preserves the boost timer instead of disarming it (FIX A)', async () => {
    // The shape a live timed override takes after boost()'s own GET: no
    // `duration` (that's request-only), a positive `remaining`.
    override_store.set({ state: 'active', charge_current: 48, auto_release: false, remaining: 600 })
    httpAPI.mockResolvedValue({ msg: 'done' })

    const result = await override_store.removeProp('charge_current')

    expect(result).toBe(true)
    // Must be a POST carrying a positive duration and no `remaining` — not a
    // bare {state, auto_release} that silently drops the device timer.
    const call = httpAPI.mock.calls.find((c) => c[0] === 'POST' && c[1] === '/override')
    expect(call).toBeTruthy()
    const body = JSON.parse(call[2])
    expect(body).not.toHaveProperty('charge_current')
    expect(body).not.toHaveProperty('remaining')
    expect(body.duration).toBeGreaterThan(0)
    expect(body.duration).toBeLessThanOrEqual(600)
    expect(get(override_store)).not.toHaveProperty('remaining')
    expect(get(override_store).duration).toBeGreaterThan(0)
  })

  it('removeProp still clears normally (no duration added) when no boost is active', async () => {
    override_store.set({ charge_current: 32, auto_release: false })
    httpAPI.mockResolvedValue({ msg: 'done' })
    const result = await override_store.removeProp('charge_current')
    expect(result).toBe(true)
    // Only `auto_release` is left after removing charge_current — the
    // pre-existing degenerate case that clears entirely instead of
    // uploading an empty-ish body.
    expect(httpAPI).toHaveBeenCalledWith('DELETE', '/override')
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
