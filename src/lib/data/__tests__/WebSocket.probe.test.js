// src/lib/data/__tests__/WebSocket.probe.test.js
// A device that never speaks WebSocket (JuiceBox) must not retry /ws forever.
// After a few connects that never open, WebSocket.svelte gives up and lets the
// Poller carry the session. A device that opens even once keeps reconnecting
// through transient drops.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve('error')) }))

import WebSocket from '../WebSocket.svelte'
import { uistates_store } from '../../stores/uistates.js'

// Fake WebSocket we drive by hand. Records every instance created so the test
// can count connect attempts. Each handler set is keyed per-instance.
let wsInstances
class FakeWS {
  constructor() {
    this.listeners = {}
    this.readyState = 0
    this.OPEN = 1
    wsInstances.push(this)
  }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn) }
  removeEventListener() {}
  send() {}
  close() {}
  emit(t, data) { (this.listeners[t] || []).forEach((fn) => fn({ data })) }
}

let originalWebSocket
beforeEach(() => {
  originalWebSocket = globalThis.WebSocket
  globalThis.WebSocket = FakeWS
  wsInstances = []
  uistates_store.update((u) => ({ ...u, ws_connected: true }))
  vi.useFakeTimers()
})

afterEach(() => {
  globalThis.WebSocket = originalWebSocket
  vi.useRealTimers()
})

describe('WebSocket /ws probe give-up', () => {
  it('stops probing after repeated connects that never open', async () => {
    render(WebSocket)
    await tick()
    expect(wsInstances).toHaveLength(1) // onMount connect

    // Each close (without ever opening) schedules one backoff reconnect:
    // 1s then 2s. The third failure crosses the probe limit -> give up.
    wsInstances[0].emit('close')
    await vi.advanceTimersByTimeAsync(1000)
    expect(wsInstances).toHaveLength(2)

    wsInstances[1].emit('close')
    await vi.advanceTimersByTimeAsync(2000)
    expect(wsInstances).toHaveLength(3)

    wsInstances[2].emit('close') // third never-opened failure -> stop
    await vi.advanceTimersByTimeAsync(60000) // well past the 30s cap
    expect(wsInstances).toHaveLength(3) // no fourth attempt
  })

  it('does not re-probe on an online event once it has given up', async () => {
    render(WebSocket)
    await tick()
    wsInstances[0].emit('close')
    await vi.advanceTimersByTimeAsync(1000)
    wsInstances[1].emit('close')
    await vi.advanceTimersByTimeAsync(2000)
    wsInstances[2].emit('close') // give up here
    await vi.advanceTimersByTimeAsync(0)
    expect(wsInstances).toHaveLength(3)

    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(wsInstances).toHaveLength(3) // stays poll-only this session
  })

  it('never flips ws_connected to false while probing (no banner flash)', async () => {
    render(WebSocket)
    await tick()
    // Three never-opened failures (the whole probe) must not report a lost
    // connection — the Poller owns ws_connected.
    wsInstances[0].emit('error')
    wsInstances[0].emit('close')
    await vi.advanceTimersByTimeAsync(1000)
    wsInstances[1].emit('close')
    await vi.advanceTimersByTimeAsync(2000)
    wsInstances[2].emit('close')
    await vi.advanceTimersByTimeAsync(0)
    expect(get(uistates_store).ws_connected).toBe(true)
  })

  it('reports ws_connected true when the socket opens', async () => {
    uistates_store.update((u) => ({ ...u, ws_connected: false }))
    render(WebSocket)
    await tick()
    wsInstances[0].readyState = 1
    wsInstances[0].emit('open')
    expect(get(uistates_store).ws_connected).toBe(true)
  })

  it('keeps reconnecting forever once it has opened at least once', async () => {
    render(WebSocket)
    await tick()
    wsInstances[0].readyState = 1
    wsInstances[0].emit('open') // now known to be a WS device
    wsInstances[0].emit('close')
    await vi.advanceTimersByTimeAsync(1000)
    expect(wsInstances).toHaveLength(2)

    // Far more failures than the probe limit — still retries because it opened.
    wsInstances[1].emit('close')
    await vi.advanceTimersByTimeAsync(2000)
    wsInstances[2].emit('close')
    await vi.advanceTimersByTimeAsync(4000)
    expect(wsInstances).toHaveLength(4)
  })
})
