import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => {
    fn(t)
    return () => {}
  }
  return { _: t }
})
vi.mock('../../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { notification_store } from '../../../stores/notifications.js'
import AdvisoryStrip from '../AdvisoryStrip.svelte'

function item(id, over = {}) {
  return {
    id,
    category: 'safety',
    severity: 'critical',
    sticky: true,
    acked: false,
    first_seen: 1779400000,
    last_seen: 1779400830,
    ...over,
  }
}

function seed(items) {
  notification_store.set({ count: items.filter((n) => !n.acked).length, severity: 'critical', items })
}

beforeEach(() => {
  notification_store.reset()
})

describe('AdvisoryStrip', () => {
  it('renders nothing when there is no critical advisory', () => {
    seed([item('safety.vent_check', { severity: 'warning' })])
    const { queryByRole } = render(AdvisoryStrip)
    expect(queryByRole('alert')).toBeNull()
  })

  it('renders nothing for a muted critical', () => {
    // A muted critical keeps its place in the list and its settings marker,
    // but it must not put the loudest thing in the UI back on screen.
    seed([item('safety.ground_check', { acked: true })])
    const { queryByRole } = render(AdvisoryStrip)
    expect(queryByRole('alert')).toBeNull()
  })

  it('names each unmuted critical and links it', () => {
    seed([item('safety.ground_check')])
    const { getByRole, getByText } = render(AdvisoryStrip)
    expect(getByRole('alert')).toBeInTheDocument()
    expect(getByText('notifications.title.safety.ground_check')).toBeInTheDocument()
    expect(getByText('notifications.strip_action').getAttribute('href')).toBe('#/settings/safety')
  })

  it('dismisses', async () => {
    seed([item('safety.ground_check')])
    const { getByText, queryByRole } = render(AdvisoryStrip)
    await fireEvent.click(getByText('notifications.strip_dismiss'))
    expect(queryByRole('alert')).toBeNull()
  })

  it('comes back when a different critical arrives', async () => {
    // Dismissal is tied to the set, not to the session: swallowing the next
    // critical because the reader once dismissed an earlier one is exactly
    // the crying-wolf failure in reverse.
    seed([item('safety.ground_check')])
    const { getByText, queryByRole, getByRole } = render(AdvisoryStrip)
    await fireEvent.click(getByText('notifications.strip_dismiss'))
    expect(queryByRole('alert')).toBeNull()

    seed([item('safety.ground_check'), item('fault.stuck_relay', { category: 'fault' })])
    await vi.waitFor(() => expect(getByRole('alert')).toBeInTheDocument())
  })
})
