import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import { tick } from 'svelte'

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
    class MockWS {
      static instances = []
      constructor(url) {
        this.url = url
        this.readyState = 0
        this.OPEN = 1
        MockWS.instances.push(this)
      }
      addEventListener() {}
      removeEventListener() {}
      send() {}
      close() {}
    }
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
})
