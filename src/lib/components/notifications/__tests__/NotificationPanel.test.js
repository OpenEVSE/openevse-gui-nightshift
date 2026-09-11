import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => {
    fn(t)
    return () => {}
  }
  return { _: t }
})
vi.mock('../../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { httpAPI } from '../../../api/httpAPI.js'
import { notification_store } from '../../../stores/notifications.js'
import { uistates_store } from '../../../stores/uistates.js'
import NotificationPanel from '../NotificationPanel.svelte'

function item(id, over = {}) {
  return {
    id,
    category: 'safety',
    severity: 'warning',
    sticky: true,
    acked: false,
    first_seen: 1779400000,
    last_seen: 1779400830,
    ...over,
  }
}

function seed(items, over = {}) {
  notification_store.set({ count: items.filter((n) => !n.acked).length, severity: 'warning', items, ...over })
}

beforeEach(() => {
  httpAPI.mockReset()
  notification_store.reset()
  uistates_store.resetAlertBox()
})

describe('NotificationPanel', () => {
  it('shows an empty state when there is nothing to list', () => {
    const { getByText } = render(NotificationPanel, { props: { visible: true } })
    expect(getByText('notifications.empty')).toBeInTheDocument()
  })

  it('lists a muted advisory rather than hiding it', () => {
    // Acking silences the alarm, it never clears the entry.
    seed([item('safety.vent_check', { acked: true })])
    const { getByText } = render(NotificationPanel, { props: { visible: true } })
    expect(getByText('notifications.title.safety.vent_check')).toBeInTheDocument()
    expect(getByText('notifications.muted')).toBeInTheDocument()
  })

  it('offers no ack button for something already acked', () => {
    seed([item('safety.vent_check', { acked: true })])
    const { queryByText } = render(NotificationPanel, { props: { visible: true } })
    expect(queryByText('notifications.mute')).toBeNull()
    expect(queryByText('notifications.dismiss')).toBeNull()
  })

  it('says Mute for a sticky advisory and Dismiss for one that is not', () => {
    // Two different words for one endpoint, because they are two different
    // promises: a sticky ack mutes and the entry stays; a non-sticky ack
    // dismisses until the underlying counter moves.
    seed([
      item('safety.ground_check', { sticky: true }),
      item('fault.gfci_tripped', { sticky: false, category: 'fault', first_seen: 1779300000 }),
    ])
    const { getByText } = render(NotificationPanel, { props: { visible: true } })
    expect(getByText('notifications.mute')).toBeInTheDocument()
    expect(getByText('notifications.dismiss')).toBeInTheDocument()
  })

  it('renders an unknown timestamp as unknown, not as 1970', () => {
    seed([item('thermal.relay_thermal', { first_seen: null, last_seen: null })])
    const { getByText } = render(NotificationPanel, { props: { visible: true } })
    expect(getByText('notifications.time_unknown')).toBeInTheDocument()
  })

  it('links each advisory to the page that acts on it', () => {
    seed([item('safety.ground_check'), item('wear.relay_life', { first_seen: 1779300000 })])
    const { getByText } = render(NotificationPanel, { props: { visible: true } })
    expect(getByText('notifications.link.safety').getAttribute('href')).toBe('#/settings/safety')
    expect(getByText('notifications.link.health').getAttribute('href')).toBe('#/monitoring/health')
  })

  it('falls back to the raw id for an advisory this build has no copy for', () => {
    // Ids are stable and locale-independent; a newer firmware can ship one we
    // have no prose for, and a missing-key placeholder would be worse.
    seed([item('safety.invented_check')])
    const { getByText, queryByText } = render(NotificationPanel, { props: { visible: true } })
    expect(getByText('safety.invented_check')).toBeInTheDocument()
    expect(queryByText('notifications.title.safety.invented_check')).toBeNull()
  })

  it('acks through the store', async () => {
    seed([item('safety.ground_check')])
    httpAPI
      .mockResolvedValueOnce('acknowledged')
      .mockResolvedValueOnce({ count: 0, max_severity: 'info', notifications: [] })

    const { getByText } = render(NotificationPanel, { props: { visible: true } })
    await fireEvent.click(getByText('notifications.mute'))

    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith(
        'POST',
        '/notifications/ack',
        'id=safety.ground_check',
        'text',
      )
    })
  })

  it('stays quiet when an ack misses because the advisory already cleared', async () => {
    // A 404 means it went away between render and tap; the re-read inside
    // ack() has already corrected the list, so there is nothing to alert about.
    seed([item('safety.ground_check')])
    httpAPI
      .mockResolvedValueOnce('no such active notification')
      .mockResolvedValueOnce({ count: 0, max_severity: 'info', notifications: [] })

    const { getByText } = render(NotificationPanel, { props: { visible: true } })
    await fireEvent.click(getByText('notifications.mute'))

    await vi.waitFor(() => {
      expect(get(notification_store).items).toEqual([])
    })
    expect(get(uistates_store).alertbox.visible).toBe(false)
  })

  it('raises an alert when an ack fails and the advisory is still there', async () => {
    seed([item('safety.ground_check')])
    httpAPI.mockResolvedValueOnce('error').mockResolvedValueOnce('error')

    const { getByText } = render(NotificationPanel, { props: { visible: true } })
    await fireEvent.click(getByText('notifications.mute'))

    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })
})
