// src/lib/components/config/__tests__/SafetyChecksCard.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../api/httpAPI.js'
import { config_store } from '../../../stores/config.js'
import { uistates_store } from '../../../stores/uistates.js'
import { notification_store } from '../../../stores/notifications.js'
import SafetyChecksCard from '../SafetyChecksCard.svelte'

const ALL_ON = {
  gfci_check: true, ground_check: true, relay_check: true,
  temp_check: true, diode_check: true, vent_check: true,
}

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  notification_store.reset()
})

function advisory(id, over = {}) {
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

describe('Safety checks card', () => {
  it('shows the warning banner when a check is off', () => {
    config_store.set({ ...ALL_ON, vent_check: false })
    const { getByText } = render(SafetyChecksCard)
    expect(getByText('config.safety.warning')).toBeInTheDocument()
  })

  it('hides the warning banner when every check is on', () => {
    config_store.set({ ...ALL_ON })
    const { queryByText } = render(SafetyChecksCard)
    expect(queryByText('config.safety.warning')).not.toBeInTheDocument()
  })

  it('marks all required checks on even when GFCI self-test is off', () => {
    // GFCI is optional — it must not drop the all-required-on status.
    config_store.set({ ...ALL_ON, gfci_check: false })
    const { getByText, queryByText } = render(SafetyChecksCard)
    expect(getByText('config.safety.all_on')).toBeInTheDocument()
    expect(queryByText('config.safety.warning')).not.toBeInTheDocument()
  })

  it('saves a check toggle on change', async () => {
    config_store.set({ ...ALL_ON })
    const { getByText, getAllByRole } = render(SafetyChecksCard)
    // Checks card is collapsed by default — expand it to reach the toggles.
    await fireEvent.click(getByText('config.safety.checks'))
    await fireEvent.click(getAllByRole('switch')[0])
    expect(httpAPI).toHaveBeenCalled()
    const [, , body] = httpAPI.mock.calls[0]
    expect(body).toBe(JSON.stringify({ gfci_check: false }))
  })

  it('shows the alert box when a save fails', async () => {
    httpAPI.mockResolvedValue('error')
    config_store.set({ ...ALL_ON })
    const { getByText, getAllByRole } = render(SafetyChecksCard)
    await fireEvent.click(getByText('config.safety.checks'))
    await fireEvent.click(getAllByRole('switch')[0])
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })
})

describe('Safety checks card — collapsible checks', () => {
  it('hides the check toggles until the card is expanded', async () => {
    config_store.set({ ...ALL_ON })
    const { getByText, queryByLabelText, getByLabelText } = render(SafetyChecksCard)
    expect(queryByLabelText('config.safety.gfci_check')).toBeNull()
    await fireEvent.click(getByText('config.safety.checks'))
    expect(getByLabelText('config.safety.gfci_check')).toBeInTheDocument()
  })

  it('shows the all-checks-on status when every check is on', () => {
    config_store.set({ ...ALL_ON })
    const { getByText, queryByText } = render(SafetyChecksCard)
    expect(getByText('config.safety.all_on')).toBeInTheDocument()
    expect(queryByText('config.safety.warning')).not.toBeInTheDocument()
  })

  it('offers a temperature-monitoring toggle when the charger has one', async () => {
    // safety.temp_check is one of the fifteen advisories, and "temperature
    // monitoring is off" is worth nothing without the switch that fixes it.
    config_store.set({ ...ALL_ON })
    const { getByText, getByLabelText } = render(SafetyChecksCard)
    await fireEvent.click(getByText('config.safety.checks'))
    expect(getByLabelText('config.safety.temp_check')).toBeInTheDocument()
  })

  it('omits it on a charger whose config has no such key', async () => {
    // Absent means "no such setting". An unconditional toggle would read the
    // missing key as off and offer to fix something that isn't broken.
    const { temp_check, ...withoutTempCheck } = ALL_ON
    config_store.set(withoutTempCheck)
    const { getByText, queryByLabelText } = render(SafetyChecksCard)
    await fireEvent.click(getByText('config.safety.checks'))
    expect(queryByLabelText('config.safety.temp_check')).toBeNull()
  })
})

describe('Safety checks card — advisory markers', () => {
  it('marks the very switch an advisory is about', () => {
    config_store.set({ ...ALL_ON, ground_check: false })
    notification_store.set({
      count: 1,
      severity: 'critical',
      items: [advisory('safety.ground_check', { severity: 'critical' })],
    })
    // No click: an advisory opens the card for itself — a marker behind a
    // collapsed card is a marker nobody reads.
    const { getAllByText } = render(SafetyChecksCard)
    expect(getAllByText('notifications.severity.critical')).toHaveLength(1)
  })

  it('still marks a muted advisory', () => {
    // The whole point of §4.1: acking silences the alarm, it never hides the
    // state. The owner who muted "ground check is off" still sees it here.
    config_store.set({ ...ALL_ON, ground_check: false })
    notification_store.set({
      count: 0,
      severity: 'info',
      items: [advisory('safety.ground_check', { severity: 'critical', acked: true })],
    })
    const { getByText } = render(SafetyChecksCard)
    expect(getByText('notifications.severity.critical')).toBeInTheDocument()
    expect(getByText('notifications.muted')).toBeInTheDocument()
  })

  it('lets a deliberate collapse stand', async () => {
    config_store.set({ ...ALL_ON, ground_check: false })
    notification_store.set({
      count: 1,
      severity: 'critical',
      items: [advisory('safety.ground_check', { severity: 'critical' })],
    })
    const { getByText, queryByText } = render(SafetyChecksCard)
    await fireEvent.click(getByText('config.safety.checks'))
    expect(queryByText('notifications.severity.critical')).toBeNull()

    // The next poll must not prise it back open.
    notification_store.set({
      count: 1,
      severity: 'critical',
      items: [advisory('safety.ground_check', { severity: 'critical', last_seen: 1779400900 })],
    })
    await vi.waitFor(() => expect(queryByText('notifications.severity.critical')).toBeNull())
  })

  it('surfaces the count on the collapsed card header', async () => {
    // The checks card starts collapsed, so an advisory would otherwise be
    // invisible on the one page that can act on it.
    config_store.set({ ...ALL_ON, ground_check: false, vent_check: false })
    notification_store.set({
      count: 1,
      severity: 'critical',
      items: [
        advisory('safety.ground_check', { severity: 'critical' }),
        advisory('safety.vent_check', { acked: true }),
      ],
    })
    const { getByText, queryByText } = render(SafetyChecksCard)
    expect(getByText('notifications.checks_off')).toBeInTheDocument()
    // The header's own wording steps aside rather than stacking with it.
    expect(queryByText('config.safety.warning')).toBeNull()
  })

  it('renders no marker when the charger reports nothing', async () => {
    config_store.set({ ...ALL_ON })
    const { getByText, queryByText } = render(SafetyChecksCard)
    await fireEvent.click(getByText('config.safety.checks'))
    expect(queryByText('notifications.severity.critical')).toBeNull()
    expect(queryByText('notifications.severity.warning')).toBeNull()
    expect(getByText('config.safety.all_on')).toBeInTheDocument()
  })
})

describe('Safety checks card — GFCI note', () => {
  it('tells the installer to disable the self-test on a GFCI-protected circuit', async () => {
    config_store.set({ ...ALL_ON })
    const { getByText } = render(SafetyChecksCard)
    await fireEvent.click(getByText('config.safety.checks'))
    expect(getByText('config.safety.gfci_check_desc')).toBeInTheDocument()
  })

  it('puts the note on the GFCI self-test only', async () => {
    config_store.set({ ...ALL_ON })
    const { getByText, getAllByText } = render(SafetyChecksCard)
    await fireEvent.click(getByText('config.safety.checks'))
    expect(getAllByText('config.safety.gfci_check_desc')).toHaveLength(1)
  })
})
