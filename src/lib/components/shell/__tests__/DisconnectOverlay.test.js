import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import { uistates_store } from '../../../stores/uistates.js'
import DisconnectOverlay from '../DisconnectOverlay.svelte'

// Grace period before the blocking modal escalates (must match the component).
const GRACE_MS = 6000

function setConn(connected, lastSeen) {
  uistates_store.update((s) => ({
    ...s,
    ws_connected: connected,
    ...(lastSeen !== undefined ? { ws_last_seen: lastSeen } : {}),
  }))
}

beforeEach(() => {
  vi.useFakeTimers()
  uistates_store.update((s) => ({ ...s, ws_connected: true, ws_last_seen: 0, ws_retry_request: 0 }))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('DisconnectOverlay', () => {
  it('shows nothing while connected', () => {
    const { queryByRole } = render(DisconnectOverlay)
    expect(queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not escalate to the modal during the grace period', async () => {
    const { queryByRole } = render(DisconnectOverlay)
    setConn(false)
    await vi.advanceTimersByTimeAsync(GRACE_MS - 500)
    expect(queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('escalates to the blocking modal after the grace period', async () => {
    const { queryByRole, getByText } = render(DisconnectOverlay)
    setConn(false)
    await vi.advanceTimersByTimeAsync(GRACE_MS + 100)
    expect(queryByRole('dialog')).toBeInTheDocument()
    expect(getByText('connection.offline_reason')).toBeInTheDocument()
  })

  it('clears the modal when the connection is restored', async () => {
    const { queryByRole } = render(DisconnectOverlay)
    setConn(false)
    await vi.advanceTimersByTimeAsync(GRACE_MS + 100)
    expect(queryByRole('dialog')).toBeInTheDocument()
    setConn(true)
    await vi.advanceTimersByTimeAsync(50)
    expect(queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not escalate for a brief blip that reconnects within the grace period', async () => {
    const { queryByRole } = render(DisconnectOverlay)
    setConn(false)
    await vi.advanceTimersByTimeAsync(2000)
    setConn(true)
    await vi.advanceTimersByTimeAsync(GRACE_MS)
    expect(queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('requests an immediate reconnect when Retry is clicked', async () => {
    const { getByText } = render(DisconnectOverlay)
    setConn(false)
    await vi.advanceTimersByTimeAsync(GRACE_MS + 100)
    const before = get(uistates_store).ws_retry_request
    getByText('connection.offline_retry').click()
    await vi.advanceTimersByTimeAsync(0)
    expect(get(uistates_store).ws_retry_request).toBe(before + 1)
  })
})
