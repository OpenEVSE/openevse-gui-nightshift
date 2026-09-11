import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  // Echo the key plus any interpolated values, so a test can assert that the
  // count actually reached the label rather than just that a key was used.
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => {
    fn(t)
    return () => {}
  }
  return { _: t }
})
vi.mock('../../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { notification_store } from '../../../stores/notifications.js'
import NotificationBell from '../NotificationBell.svelte'

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

beforeEach(() => {
  notification_store.reset()
})

describe('NotificationBell', () => {
  it('renders nothing on a charger with nothing to report', () => {
    // Also the capability gate reaching the header: a build with no advisory
    // engine never fills the store, so the bell never appears.
    const { container } = render(NotificationBell)
    expect(container.querySelector('button')).toBeNull()
  })

  it('appears for a list that is entirely muted, with no badge', () => {
    // count 0 beside a non-empty list is a legitimate payload. The muted
    // advisory must stay reachable even though the alarm is silent.
    notification_store.set({
      count: 0,
      severity: 'info',
      items: [item('safety.vent_check', { acked: true })],
    })
    const { getByLabelText } = render(NotificationBell)
    const button = getByLabelText('notifications.bell:{"count":0}')
    expect(button).toBeInTheDocument()
    expect(button.parentElement.textContent.trim()).toBe('')
  })

  it('badges the unmuted count', () => {
    notification_store.set({
      count: 2,
      severity: 'warning',
      items: [item('safety.ground_check'), item('safety.vent_check')],
    })
    const { getByText } = render(NotificationBell)
    expect(getByText('2')).toBeInTheDocument()
  })

  it('paints the badge red only for a critical', () => {
    // The firmware reserves red for the fault screen; amber is the advisory
    // tier's colour, on the LCD and here.
    notification_store.set({ count: 1, severity: 'warning', items: [item('safety.vent_check')] })
    const warned = render(NotificationBell)
    expect(warned.getByText('1').className).toContain('bg-warning')
    warned.unmount()

    notification_store.set({
      count: 1,
      severity: 'critical',
      items: [item('safety.ground_check', { severity: 'critical' })],
    })
    const critical = render(NotificationBell)
    expect(critical.getByText('1').className).toContain('bg-error')
  })

  it('opens the panel', async () => {
    notification_store.set({ count: 1, severity: 'warning', items: [item('safety.vent_check')] })
    const { getByLabelText, getByRole, queryByRole } = render(NotificationBell)
    expect(queryByRole('dialog')).toBeNull()
    await fireEvent.click(getByLabelText('notifications.bell:{"count":1}'))
    expect(getByRole('dialog')).toBeInTheDocument()
  })
})
