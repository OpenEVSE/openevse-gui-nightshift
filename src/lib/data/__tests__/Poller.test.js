// src/lib/data/__tests__/Poller.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { httpAPI } from '../../api/httpAPI.js'
import { status_store } from '../../stores/status.js'
import { uistates_store } from '../../stores/uistates.js'
import Poller from '../Poller.svelte'

beforeEach(() => {
  vi.useFakeTimers()
  httpAPI.mockReset()
  status_store.set(undefined)
  uistates_store.update((u) => ({ ...u, ws_connected: true }))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Poller', () => {
  it('merges a successful poll into status_store and marks connected', async () => {
    httpAPI.mockResolvedValue({ amp: 24, state: 3 })
    render(Poller)
    // advance enough for the immediate poll on mount to resolve
    await vi.advanceTimersByTimeAsync(0)
    expect(get(status_store)?.amp).toBe(24)
    expect(get(uistates_store).ws_connected).toBe(true)
  })

  it('marks disconnected when a poll fails', async () => {
    httpAPI.mockResolvedValue('error')
    render(Poller)
    await vi.advanceTimersByTimeAsync(0)
    expect(get(uistates_store).ws_connected).toBe(false)
  })

  it('does not poll when active is false', async () => {
    httpAPI.mockResolvedValue({ amp: 1 })
    render(Poller, { props: { active: false } })
    await vi.advanceTimersByTimeAsync(0)
    expect(httpAPI).not.toHaveBeenCalled()
  })

  it('stops polling after active prop is set to false', async () => {
    httpAPI.mockResolvedValue({ amp: 1 })
    const { rerender } = render(Poller, { props: { active: true } })
    // Let the initial mount poll fire and resolve
    await vi.advanceTimersByTimeAsync(0)
    const callsAfterFirstPoll = httpAPI.mock.calls.length
    expect(callsAfterFirstPoll).toBeGreaterThan(0)

    // Disable polling
    await rerender({ active: false })

    // Advance past multiple poll intervals — no new calls should happen
    await vi.advanceTimersByTimeAsync(1500 * 3)
    expect(httpAPI.mock.calls.length).toBe(callsAfterFirstPoll)
  })

  it('blocks overlapping polls when a request is inflight', async () => {
    // Never resolves — keeps inflight=true for the entire test
    httpAPI.mockReturnValue(new Promise(() => {}))
    render(Poller)

    // Advance past several poll intervals
    await vi.advanceTimersByTimeAsync(1500 * 3)

    // Despite multiple ticks, httpAPI should only have been called once
    expect(httpAPI).toHaveBeenCalledTimes(1)
  })
})
