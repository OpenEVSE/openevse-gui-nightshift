// The capability gate, tested where it actually lives: DataManager decides
// whether the advisory list is ever fetched, and everything downstream (the
// bell, the dashboard strip, the settings markers) is hidden simply because
// the store stays empty.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { httpAPI } from '../../api/httpAPI.js'
import DataManager from '../DataManager.svelte'
import { status_store } from '../../stores/status.js'
import { uistates_store } from '../../stores/uistates.js'
import { notification_store } from '../../stores/notifications.js'

const LIST = {
  count: 1,
  max_severity: 'warning',
  notifications: [
    {
      id: 'safety.vent_check',
      category: 'safety',
      severity: 'warning',
      sticky: true,
      acked: false,
      first_seen: 1779400000,
      last_seen: 1779400830,
    },
  ],
}

function notificationCalls() {
  return httpAPI.mock.calls.filter((c) => c[1] === '/notifications')
}

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockImplementation((method, url) =>
    Promise.resolve(url === '/notifications' ? LIST : 'error'),
  )
  status_store.set(undefined)
  notification_store.reset()
  uistates_store.update((s) => ({ ...s, notification_badge: null }))
})

afterEach(() => cleanup())

describe('the advisory capability gate', () => {
  it('never asks a charger that predates advisories', async () => {
    // No `notifications` object in /status → badgeSignature is null → the
    // store stays empty and the whole surface stays hidden.
    status_store.set({ state: 1, config_version: 1 })
    render(DataManager)
    await vi.waitFor(() => expect(httpAPI).toHaveBeenCalled())
    expect(notificationCalls()).toHaveLength(0)
    expect(get(notification_store).items).toEqual([])
  })

  it('asks a charger that has the engine but nothing to report', async () => {
    // Presence is the gate, never the values: {count: 0} is still a yes.
    status_store.set({ state: 1, notifications: { count: 0, severity: 'info' } })
    render(DataManager)
    await vi.waitFor(() => expect(notificationCalls()).toHaveLength(1))
    expect(get(uistates_store).notification_badge).toBe('0:info')
  })

  it('re-reads when the badge moves and not while it holds still', async () => {
    status_store.set({ state: 1, notifications: { count: 1, severity: 'warning' } })
    render(DataManager)
    await vi.waitFor(() => expect(notificationCalls()).toHaveLength(1))

    // A websocket frame that changes nothing about the advisory set.
    status_store.update((s) => ({ ...s, amp: 32 }))
    await vi.waitFor(() => expect(get(status_store).amp).toBe(32))
    expect(notificationCalls()).toHaveLength(1)

    // Now the set really moves.
    status_store.update((s) => ({ ...s, notifications: { count: 2, severity: 'critical' } }))
    await vi.waitFor(() => expect(notificationCalls()).toHaveLength(2))
  })
})
