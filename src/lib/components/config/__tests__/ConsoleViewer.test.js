// src/lib/components/config/__tests__/ConsoleViewer.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

// Force WebSocket construction to throw so the component enters its `failed` state.
let origWebSocket
beforeEach(() => {
  origWebSocket = globalThis.WebSocket
  globalThis.WebSocket = class {
    constructor() { throw new Error('WebSocket not available') }
  }
})
afterEach(() => {
  globalThis.WebSocket = origWebSocket
})

import ConsoleViewer from '../ConsoleViewer.svelte'

describe('ConsoleViewer', () => {
  it('shows unavailable text when WebSocket construction fails', () => {
    const { getByText } = render(ConsoleViewer, { mode: 'debug' })
    expect(getByText('config.terminal.unavailable')).toBeInTheDocument()
  })
})
