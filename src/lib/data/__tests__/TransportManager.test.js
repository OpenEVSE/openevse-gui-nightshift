// src/lib/data/__tests__/TransportManager.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve('error')) }))

import { httpAPI } from '../../api/httpAPI.js'
import { uistates_store } from '../../stores/uistates.js'
import TransportManager from '../TransportManager.svelte'

// A fake WebSocket we drive by hand. Captures the latest instance.
let lastWs
class FakeWS {
  constructor() { this.listeners = {}; lastWs = this; this.readyState = 0; this.OPEN = 1 }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn) }
  removeEventListener() {}
  send() {}
  close() { this.emit('close') }
  emit(t, data) { (this.listeners[t] || []).forEach((fn) => fn({ data })) }
}

let originalWebSocket
beforeEach(() => {
  originalWebSocket = globalThis.WebSocket
  globalThis.WebSocket = FakeWS
  httpAPI.mockReset()
  httpAPI.mockResolvedValue('error')
  lastWs = undefined
  uistates_store.update((u) => ({ ...u, ws_connected: true }))
})

afterEach(() => {
  globalThis.WebSocket = originalWebSocket
  vi.useRealTimers()
})

describe('TransportManager', () => {
  it('polls at startup before any WebSocket is live', async () => {
    httpAPI.mockResolvedValue({ amp: 5 })
    render(TransportManager)
    await vi.waitFor(() => expect(httpAPI).toHaveBeenCalledWith('GET', '/status'))
  })

  it('stops polling once the WebSocket goes live', async () => {
    vi.useFakeTimers()
    httpAPI.mockResolvedValue({ amp: 5 })
    render(TransportManager)
    // lastWs is set synchronously when WebSocket mounts; drain the initial poll.
    await vi.advanceTimersByTimeAsync(0)
    lastWs.readyState = 1
    lastWs.emit('open')
    lastWs.emit('message', '{"amp":6}')
    const callsAfterLive = httpAPI.mock.calls.length
    await vi.advanceTimersByTimeAsync(1500 * 5) // five poll intervals
    expect(httpAPI.mock.calls.length).toBe(callsAfterLive)
  })
})
