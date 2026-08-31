import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { get } from 'svelte/store'

// The module reads window.* and keeps module-level state (the once-flag,
// the cached snapshot) at import time, so each scenario re-imports fresh
// via vi.resetModules() after arranging the globals.
function setBridge({ host, rn } = {}) {
  if (host === undefined) delete window.OpenEVSEHost
  else window.OpenEVSEHost = host
  if (rn === undefined) delete window.ReactNativeWebView
  else window.ReactNativeWebView = rn
}

beforeEach(() => {
  vi.resetModules()
  setBridge()
})
afterEach(() => setBridge())

describe('nativeHost', () => {
  it('reports not-embedded and stays silent in a plain browser', async () => {
    const mod = await import('../nativeHost.js')
    expect(get(mod.host)).toEqual({ embedded: false, hasDrawer: false })
    // Nothing to post, and openDrawer must not throw without a bridge.
    expect(() => mod.announce()).not.toThrow()
    expect(() => mod.openDrawer()).not.toThrow()
  })

  it('announces once (idempotent) and opens the drawer when embedded with a drawer', async () => {
    const postMessage = vi.fn()
    setBridge({ host: { version: 1, drawer: true }, rn: { postMessage } })
    const mod = await import('../nativeHost.js')

    expect(get(mod.host)).toEqual({ embedded: true, hasDrawer: true })

    mod.announce()
    mod.announce() // second call is a no-op thanks to the once-flag
    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({ type: 'hostUi', drawerButton: true })

    mod.openDrawer()
    expect(JSON.parse(postMessage.mock.calls[1][0])).toEqual({ type: 'openDrawer' })
  })

  it('announces drawerButton:false when embedded without a drawer', async () => {
    const postMessage = vi.fn()
    setBridge({ host: { version: 1, drawer: false }, rn: { postMessage } })
    const mod = await import('../nativeHost.js')

    expect(get(mod.host)).toEqual({ embedded: true, hasDrawer: false })
    mod.announce()
    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({ type: 'hostUi', drawerButton: false })
  })

  it('swallows a throwing bridge rather than breaking the page', async () => {
    const postMessage = vi.fn(() => {
      throw new Error('bridge went away')
    })
    setBridge({ host: { drawer: true }, rn: { postMessage } })
    const mod = await import('../nativeHost.js')

    expect(() => mod.announce()).not.toThrow()
    expect(() => mod.openDrawer()).not.toThrow()
  })

  it('picks up a late Android injection via the openevsehost event and announces exactly once', async () => {
    // Bundle ran before the app set its globals (Android onPageStarted race).
    const mod = await import('../nativeHost.js')
    // A live subscription starts the readable, wiring up the event listener.
    const unsub = mod.host.subscribe(() => {})
    expect(get(mod.host)).toEqual({ embedded: false, hasDrawer: false })

    // App arrives: sets globals at document end and fires the event.
    const postMessage = vi.fn()
    setBridge({ host: { version: 1, drawer: true }, rn: { postMessage } })
    window.dispatchEvent(new Event('openevsehost'))

    expect(get(mod.host)).toEqual({ embedded: true, hasDrawer: true })
    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({ type: 'hostUi', drawerButton: true })

    // A second late event must not re-announce.
    window.dispatchEvent(new Event('openevsehost'))
    expect(postMessage).toHaveBeenCalledTimes(1)

    unsub()
  })
})
