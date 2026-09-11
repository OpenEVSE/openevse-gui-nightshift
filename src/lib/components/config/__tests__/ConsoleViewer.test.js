// src/lib/components/config/__tests__/ConsoleViewer.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve('')) }))

import { httpAPI } from '../../../api/httpAPI.js'
import ConsoleViewer from '../ConsoleViewer.svelte'

// A WebSocket stand-in whose events the test fires by hand, so history and
// live traffic can be interleaved deliberately.
class FakeSocket {
  static last
  constructor(url) {
    this.url = url
    this.listeners = {}
    this.closed = false
    FakeSocket.last = this
  }
  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn)
  }
  emit(type, event) {
    for (const fn of this.listeners[type] || []) fn(event)
  }
  close() {
    this.closed = true
  }
}

let origWebSocket
beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue('')
  origWebSocket = globalThis.WebSocket
  FakeSocket.last = undefined
  globalThis.WebSocket = FakeSocket
})
afterEach(() => {
  globalThis.WebSocket = origWebSocket
})

// The component awaits the history fetch before constructing the socket, so
// tests have to let that microtask settle before FakeSocket.last exists.
const settle = () => vi.waitFor(() => expect(FakeSocket.last).toBeDefined())

describe('ConsoleViewer', () => {
  it('shows unavailable text when WebSocket construction fails', async () => {
    globalThis.WebSocket = class {
      constructor() { throw new Error('WebSocket not available') }
    }
    const { getByText } = render(ConsoleViewer, { mode: 'debug' })
    await vi.waitFor(() => {
      expect(getByText('config.terminal.unavailable')).toBeInTheDocument()
    })
  })

  it('loads the buffered history from the mode endpoint', async () => {
    httpAPI.mockResolvedValue('boot line 1\nboot line 2\n')
    const { getByText } = render(ConsoleViewer, { mode: 'evse' })
    await vi.waitFor(() => {
      expect(getByText(/boot line 1/)).toBeInTheDocument()
    })
    expect(httpAPI).toHaveBeenCalledWith('GET', '/evse', null, 'text')
  })

  it('fetches history before opening the socket, so lines cannot double up', async () => {
    let resolveHistory
    httpAPI.mockReturnValue(new Promise((r) => (resolveHistory = r)))
    render(ConsoleViewer, { mode: 'debug' })

    // While the snapshot is outstanding there is no socket to deliver the same
    // bytes a second time.
    expect(FakeSocket.last).toBeUndefined()

    resolveHistory('history\n')
    await settle()
    expect(FakeSocket.last.url).toMatch(/\/debug\/console$/)
  })

  it('normalizes CR line endings from history and live data alike', async () => {
    httpAPI.mockResolvedValue('a\r\nb\r')
    const { container } = render(ConsoleViewer, { mode: 'debug' })
    await settle()
    FakeSocket.last.emit('message', { data: 'c\rd' })
    await vi.waitFor(() => {
      expect(container.querySelector('pre').textContent).toBe('a\nb\nc\nd')
    })
  })

  it('puts history before live output', async () => {
    httpAPI.mockResolvedValue('older\n')
    const { container } = render(ConsoleViewer, { mode: 'debug' })
    await settle()
    FakeSocket.last.emit('message', { data: 'newer\n' })
    await vi.waitFor(() => {
      expect(container.querySelector('pre').textContent).toBe('older\nnewer\n')
    })
  })

  it('reports a connected-but-quiet console rather than sitting on Connecting', async () => {
    const { getByText } = render(ConsoleViewer, { mode: 'debug' })
    await settle()
    FakeSocket.last.emit('open')
    await vi.waitFor(() => {
      expect(getByText('config.terminal.waiting')).toBeInTheDocument()
    })
  })

  it('flags a dropped stream instead of letting stale history stand in for it', async () => {
    httpAPI.mockResolvedValue('buffered output\n')
    const { getByText, queryByText } = render(ConsoleViewer, { mode: 'debug' })
    await settle()
    FakeSocket.last.emit('open')
    await vi.waitFor(() => {
      expect(getByText(/buffered output/)).toBeInTheDocument()
    })
    expect(queryByText('config.terminal.disconnected')).toBeNull()

    FakeSocket.last.emit('close')
    await vi.waitFor(() => {
      expect(getByText('config.terminal.disconnected')).toBeInTheDocument()
    })
    // The history it already had stays on screen underneath the warning.
    expect(getByText(/buffered output/)).toBeInTheDocument()
  })

  it('closes the socket on teardown without flagging a failure', async () => {
    const { unmount, queryByText } = render(ConsoleViewer, { mode: 'debug' })
    await settle()
    const socket = FakeSocket.last
    socket.emit('open')
    unmount()
    expect(socket.closed).toBe(true)
    socket.emit('close')
    expect(queryByText('config.terminal.disconnected')).toBeNull()
  })
  it('copies the buffered text to the clipboard', async () => {
    httpAPI.mockResolvedValue('line 1\nline 2\n')
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { getByText } = render(ConsoleViewer, { props: { mode: 'debug' } })
    await settle()
    FakeSocket.last.emit('message', { data: 'live\n' })
    await vi.waitFor(() => expect(getByText('config.terminal.copy')).not.toBeDisabled())
    await fireEvent.click(getByText('config.terminal.copy'))
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('line 1\nline 2\nlive\n'))
    await vi.waitFor(() => expect(getByText('config.terminal.copied')).toBeInTheDocument())
  })

  it('disables Copy while the console is empty', async () => {
    const { getByText } = render(ConsoleViewer, { props: { mode: 'debug' } })
    await settle()
    expect(getByText('config.terminal.copy')).toBeDisabled()
  })
})
