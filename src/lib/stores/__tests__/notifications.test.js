import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { notification_store } from '../notifications.js'
import { httpAPI } from '../../api/httpAPI.js'

const LIST = {
  count: 1,
  max_severity: 'critical',
  notifications: [
    {
      id: 'safety.ground_check',
      category: 'safety',
      severity: 'critical',
      sticky: true,
      acked: false,
      first_seen: 1779382830,
      last_seen: 1779400830,
    },
    {
      id: 'safety.vent_check',
      category: 'safety',
      severity: 'warning',
      sticky: true,
      acked: true,
      first_seen: 1777960830,
      last_seen: 1779400830,
    },
  ],
}

describe('notification_store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notification_store.reset()
  })

  it('starts empty and quiet', () => {
    expect(get(notification_store)).toEqual({ count: 0, severity: 'info', items: [] })
  })

  it('downloads the list, muted entries included', () => {
    httpAPI.mockResolvedValue(LIST)
    return notification_store.download().then((ok) => {
      expect(ok).toBe(true)
      expect(httpAPI).toHaveBeenCalledWith('GET', '/notifications')
      const state = get(notification_store)
      expect(state.count).toBe(1)
      expect(state.severity).toBe('critical')
      expect(state.items).toHaveLength(2)
    })
  })

  it('leaves the last good list standing when a request fails', async () => {
    httpAPI.mockResolvedValueOnce(LIST)
    await notification_store.download()

    httpAPI.mockResolvedValueOnce('error')
    const ok = await notification_store.download()

    expect(ok).toBe(false)
    // Blanking the panel on one bad round trip would look like "all clear".
    expect(get(notification_store).items).toHaveLength(2)
  })

  it('acks with a form-encoded body and a text response', async () => {
    httpAPI.mockResolvedValueOnce('acknowledged').mockResolvedValueOnce(LIST)

    const ok = await notification_store.ack('safety.ground_check')

    expect(ok).toBe(true)
    expect(httpAPI).toHaveBeenNthCalledWith(
      1,
      'POST',
      '/notifications/ack',
      'id=safety.ground_check',
      'text',
    )
  })

  it('re-reads the list after an ack', async () => {
    // The firmware pushes a websocket event only when the live set changes,
    // and an ack does not change it — so nothing would arrive to correct the
    // badge. The store has to go and look.
    httpAPI.mockResolvedValueOnce('acknowledged').mockResolvedValueOnce(LIST)

    await notification_store.ack('safety.ground_check')

    expect(httpAPI).toHaveBeenNthCalledWith(2, 'GET', '/notifications')
    expect(get(notification_store).items).toHaveLength(2)
  })

  it('reports a 404 as a miss but still re-reads', async () => {
    // "no such active notification" means it cleared between render and tap.
    httpAPI
      .mockResolvedValueOnce('no such active notification')
      .mockResolvedValueOnce({ count: 0, max_severity: 'info', notifications: [] })

    const ok = await notification_store.ack('safety.ground_check')

    expect(ok).toBe(false)
    expect(httpAPI).toHaveBeenNthCalledWith(2, 'GET', '/notifications')
    expect(get(notification_store).items).toEqual([])
  })

  it('percent-encodes the id rather than pasting it into the body', async () => {
    httpAPI.mockResolvedValueOnce('acknowledged').mockResolvedValueOnce(LIST)
    await notification_store.ack('a&b=c')
    expect(httpAPI).toHaveBeenNthCalledWith(1, 'POST', '/notifications/ack', 'id=a%26b%3Dc', 'text')
  })

  it('refuses an empty id without touching the device', async () => {
    expect(await notification_store.ack('')).toBe(false)
    expect(httpAPI).not.toHaveBeenCalled()
  })
})
