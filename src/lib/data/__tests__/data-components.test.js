import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import { tick } from 'svelte'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve('error')) }))

import WebSocket from '../WebSocket.svelte'
import DataManager from '../DataManager.svelte'
import { uistates_store } from '../../stores/uistates.js'

afterEach(() => cleanup())

describe('data components', () => {
  it('WebSocket mounts without throwing', () => {
    expect(() => render(WebSocket)).not.toThrow()
  })
  it('DataManager mounts without throwing', () => {
    expect(() => render(DataManager)).not.toThrow()
  })

  it('opens a fresh socket when ws_retry_request is bumped', async () => {
    const RealWS = globalThis.WebSocket
    MockWS.instances = []
    globalThis.WebSocket = MockWS
    uistates_store.update((s) => ({ ...s, ws_retry_request: 0 }))
    try {
      render(WebSocket)
      await tick()
      expect(MockWS.instances.length).toBe(1)

      uistates_store.update((s) => ({ ...s, ws_retry_request: (s.ws_retry_request ?? 0) + 1 }))
      await tick()
      expect(MockWS.instances.length).toBe(2)
    } finally {
      globalThis.WebSocket = RealWS
    }
  })

  it('bumps notification_event for every frame carrying the advisory object', async () => {
    // The firmware sends these two fields on the connect snapshot and then
    // only when the live set changes — so each arrival is a reason to re-read
    // the list, even when count and severity land on the same pair as before.
    const RealWS = globalThis.WebSocket
    MockWS.instances = []
    globalThis.WebSocket = MockWS
    uistates_store.update((s) => ({ ...s, ws_retry_request: 0, notification_event: 0 }))
    try {
      render(WebSocket)
      await tick()
      const ws = MockWS.instances[0]

      ws.emit('message', { data: JSON.stringify({ amp: 32 }) })
      await tick()
      expect(get(uistates_store).notification_event).toBe(0)

      const frame = JSON.stringify({ notifications: { count: 1, severity: 'critical' } })
      ws.emit('message', { data: frame })
      await tick()
      expect(get(uistates_store).notification_event).toBe(1)

      // Same values, second arrival: the set moved even though the numbers did not.
      ws.emit('message', { data: frame })
      await tick()
      expect(get(uistates_store).notification_event).toBe(2)
    } finally {
      globalThis.WebSocket = RealWS
    }
  })

  it('captures the close code into ws_debug', async () => {
    const RealWS = globalThis.WebSocket
    MockWS.instances = []
    globalThis.WebSocket = MockWS
    uistates_store.update((s) => ({ ...s, ws_retry_request: 0 }))
    try {
      render(WebSocket)
      await tick()
      MockWS.instances[0].emit('close', { code: 1006, reason: '' })
      await tick()
      expect(get(uistates_store).ws_debug.close_code).toBe(1006)
    } finally {
      globalThis.WebSocket = RealWS
    }
  })
})

// A WebSocket stand-in that records constructions and lets tests dispatch
// lifecycle events to the component's listeners.
class MockWS {
  static instances = []
  constructor(url) {
    this.url = url
    this.readyState = 0
    this.OPEN = 1
    this.listeners = {}
    MockWS.instances.push(this)
  }
  addEventListener(type, cb) {
    ;(this.listeners[type] ||= []).push(cb)
  }
  removeEventListener() {}
  send() {}
  close() {}
  emit(type, event) {
    ;(this.listeners[type] || []).forEach((cb) => cb(event))
  }
}
