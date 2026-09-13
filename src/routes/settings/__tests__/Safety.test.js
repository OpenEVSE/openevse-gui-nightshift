// src/routes/settings/__tests__/Safety.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { cabletemp_store } from '../../../lib/stores/cabletemp.js'
import { status_store } from '../../../lib/stores/status.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import { notification_store } from '../../../lib/stores/notifications.js'
import Safety from '../Safety.svelte'

const UNASSIGNED_SOURCES = [
  { source: 0, name: 'ev1', pin: 0, status: 1 },
  { source: 1, name: 'ev2', pin: 0, status: 1 },
  { source: 2, name: 'in1', pin: 0, status: 1 },
  { source: 3, name: 'in2', pin: 0, status: 1 },
]

const ALL_ON = {
  gfci_check: true, ground_check: true, relay_check: true,
  temp_check: true, diode_check: true, vent_check: true,
}

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ gfcicount: 0, nogndcount: 0, stuckcount: 0 })
  cabletemp_store.set(null)
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

describe('Safety page', () => {
  it('shows the warning banner when a check is off', () => {
    config_store.set({ ...ALL_ON, vent_check: false })
    const { getByText } = render(Safety)
    expect(getByText('config.safety.warning')).toBeInTheDocument()
  })

  it('hides the warning banner when every check is on', () => {
    config_store.set({ ...ALL_ON })
    const { queryByText } = render(Safety)
    expect(queryByText('config.safety.warning')).not.toBeInTheDocument()
  })

  it('no longer shows the fault counters (moved to Monitoring → Safety)', () => {
    config_store.set({ ...ALL_ON })
    status_store.set({ gfcicount: 3, nogndcount: 0, stuckcount: 1 })
    const { queryByText } = render(Safety)
    expect(queryByText('config.safety.faults')).not.toBeInTheDocument()
    expect(queryByText('config.safety.reset_faults')).not.toBeInTheDocument()
  })

  it('marks all required checks on even when GFCI self-test is off', () => {
    // GFCI is optional — it must not drop the all-required-on status.
    config_store.set({ ...ALL_ON, gfci_check: false })
    const { getByText, queryByText } = render(Safety)
    expect(getByText('config.safety.all_on')).toBeInTheDocument()
    expect(queryByText('config.safety.warning')).not.toBeInTheDocument()
  })

  it('saves a check toggle on change', async () => {
    config_store.set({ ...ALL_ON })
    const { getByText, getAllByRole } = render(Safety)
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
    const { getByText, getAllByRole } = render(Safety)
    await fireEvent.click(getByText('config.safety.checks'))
    await fireEvent.click(getAllByRole('switch')[0])
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })
})

describe('Safety page — collapsible checks', () => {
  it('hides the check toggles until the card is expanded', async () => {
    config_store.set({ ...ALL_ON })
    const { getByText, queryByLabelText, getByLabelText } = render(Safety)
    expect(queryByLabelText('config.safety.gfci_check')).toBeNull()
    await fireEvent.click(getByText('config.safety.checks'))
    expect(getByLabelText('config.safety.gfci_check')).toBeInTheDocument()
  })

  it('shows the all-checks-on status when every check is on', () => {
    config_store.set({ ...ALL_ON })
    const { getByText, queryByText } = render(Safety)
    expect(getByText('config.safety.all_on')).toBeInTheDocument()
    expect(queryByText('config.safety.warning')).not.toBeInTheDocument()
  })

  it('does not render the moved firmware-security controls', () => {
    config_store.set({ ...ALL_ON, heartbeat_interval: 5, heartbeat_current: 6, boot_lock: true })
    const { queryByText } = render(Safety)
    expect(queryByText('config.security.heartbeat')).not.toBeInTheDocument()
    expect(queryByText('config.security.boot_lock')).not.toBeInTheDocument()
  })

  it('offers a temperature-monitoring toggle when the charger has one', async () => {
    // safety.temp_check is one of the sixteen advisories, and "temperature
    // monitoring is off" is worth nothing without the switch that fixes it.
    config_store.set({ ...ALL_ON })
    const { getByText, getByLabelText } = render(Safety)
    await fireEvent.click(getByText('config.safety.checks'))
    expect(getByLabelText('config.safety.temp_check')).toBeInTheDocument()
  })

  it('omits it on a charger whose config has no such key', async () => {
    // Absent means "no such setting". An unconditional toggle would read the
    // missing key as off and offer to fix something that isn't broken.
    const { temp_check, ...withoutTempCheck } = ALL_ON
    config_store.set(withoutTempCheck)
    const { getByText, queryByLabelText } = render(Safety)
    await fireEvent.click(getByText('config.safety.checks'))
    expect(queryByLabelText('config.safety.temp_check')).toBeNull()
  })
})

describe('Safety page — advisory markers', () => {
  it('marks the very switch an advisory is about', () => {
    config_store.set({ ...ALL_ON, ground_check: false })
    notification_store.set({
      count: 1,
      severity: 'critical',
      items: [advisory('safety.ground_check', { severity: 'critical' })],
    })
    // No click: an advisory opens the card for itself — a marker behind a
    // collapsed card is a marker nobody reads.
    const { getAllByText } = render(Safety)
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
    const { getByText } = render(Safety)
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
    const { getByText, queryByText } = render(Safety)
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
    const { getByText, queryByText } = render(Safety)
    expect(getByText('notifications.checks_off')).toBeInTheDocument()
    // The header's own wording steps aside rather than stacking with it.
    expect(queryByText('config.safety.warning')).toBeNull()
  })

  it('renders no marker when the charger reports nothing', async () => {
    config_store.set({ ...ALL_ON })
    const { getByText, queryByText } = render(Safety)
    await fireEvent.click(getByText('config.safety.checks'))
    expect(queryByText('notifications.severity.critical')).toBeNull()
    expect(queryByText('notifications.severity.warning')).toBeNull()
    expect(getByText('config.safety.all_on')).toBeInTheDocument()
  })
})

describe('Safety page — Cable Temperature Monitoring', () => {
  it('hides the Cable Temperature card when the controller does not report it', () => {
    config_store.set({ ...ALL_ON })
    const { queryByText } = render(Safety)
    expect(queryByText('config.cabletemp.title')).not.toBeInTheDocument()
  })

  it('shows the card collapsed, and the enable toggle once expanded', async () => {
    config_store.set({ ...ALL_ON, cable_temp: false })
    const { getByText, getByLabelText, queryByLabelText } = render(Safety)
    expect(queryByLabelText('config.cabletemp.enable')).toBeNull()
    await fireEvent.click(getByText('config.cabletemp.title'))
    expect(getByLabelText('config.cabletemp.enable')).toBeInTheDocument()
  })

  it('saves the enable toggle to /config', async () => {
    config_store.set({ ...ALL_ON, cable_temp: false })
    const { getByText, getByLabelText } = render(Safety)
    await fireEvent.click(getByText('config.cabletemp.title'))
    await fireEvent.click(getByLabelText('config.cabletemp.enable'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ cable_temp: true }))
  })

  it('does not show the input selectors while the feature is off', async () => {
    config_store.set({ ...ALL_ON, cable_temp: false })
    const { getByText, queryByText } = render(Safety)
    await fireEvent.click(getByText('config.cabletemp.title'))
    expect(queryByText('config.cabletemp.input1')).not.toBeInTheDocument()
  })

  it('fetches /cabletemp and shows both input selectors once enabled', async () => {
    config_store.set({ ...ALL_ON, cable_temp: true })
    httpAPI.mockImplementation((method, url) =>
      (method === 'GET' && url === '/cabletemp')
        ? Promise.resolve({ supported: true, enabled: false, sources: UNASSIGNED_SOURCES })
        : Promise.resolve({ msg: 'done' }),
    )
    const { getByText } = render(Safety)
    await fireEvent.click(getByText('config.cabletemp.title'))
    await vi.waitFor(() => {
      expect(getByText('config.cabletemp.input1')).toBeInTheDocument()
      expect(getByText('config.cabletemp.input2')).toBeInTheDocument()
    })
  })

  it('hides calibration fields until a source is assigned to that input', async () => {
    config_store.set({ ...ALL_ON, cable_temp: true })
    httpAPI.mockImplementation((method, url) =>
      (method === 'GET' && url === '/cabletemp')
        ? Promise.resolve({ supported: true, enabled: false, sources: UNASSIGNED_SOURCES })
        : Promise.resolve({ msg: 'done' }),
    )
    const { getByText, queryByText } = render(Safety)
    await fireEvent.click(getByText('config.cabletemp.title'))
    await vi.waitFor(() => expect(getByText('config.cabletemp.input1')).toBeInTheDocument())
    expect(queryByText('config.cabletemp.reading')).not.toBeInTheDocument()
  })

  it('assigns the picked source to Input 1 (PP)', async () => {
    config_store.set({ ...ALL_ON, cable_temp: true })
    httpAPI.mockImplementation((method, url) =>
      (method === 'GET' && url === '/cabletemp')
        ? Promise.resolve({ supported: true, enabled: false, sources: UNASSIGNED_SOURCES })
        : Promise.resolve({ msg: 'done' }),
    )
    const { getByText, getAllByRole } = render(Safety)
    await fireEvent.click(getByText('config.cabletemp.title'))
    await vi.waitFor(() => expect(getByText('config.cabletemp.input1')).toBeInTheDocument())

    const selects = getAllByRole('combobox')
    await fireEvent.change(selects[0], { target: { value: '0' } }) // Input 1 <- EV Cable 1
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/cabletemp', JSON.stringify({ source: 0, pin: 1 }))
    })
  })

  it('unassigns the previous source before assigning the new one when changing an input', async () => {
    config_store.set({ ...ALL_ON, cable_temp: true })
    const assigned = UNASSIGNED_SOURCES.map((s) => (s.source === 0 ? { ...s, pin: 1, status: 0, temperature: 20 } : s))
    httpAPI.mockImplementation((method, url) =>
      (method === 'GET' && url === '/cabletemp')
        ? Promise.resolve({ supported: true, enabled: true, sources: assigned })
        : Promise.resolve({ msg: 'done' }),
    )
    const { getByText, getAllByRole } = render(Safety)
    await fireEvent.click(getByText('config.cabletemp.title'))
    await vi.waitFor(() => expect(getByText('config.cabletemp.input1')).toBeInTheDocument())

    httpAPI.mockClear()
    const selects = getAllByRole('combobox')
    await fireEvent.change(selects[0], { target: { value: '2' } }) // Input 1: EV1 -> IN1
    await vi.waitFor(() => expect(httpAPI).toHaveBeenCalledTimes(3))
    // Order matters: the old source has to be off the pin before the new one
    // takes it, and the re-read comes last so the store reflects both writes.
    expect(httpAPI.mock.calls.map((c) => c.slice(0, 3))).toEqual([
      ['POST', '/cabletemp', JSON.stringify({ source: 0, pin: 0 })],
      ['POST', '/cabletemp', JSON.stringify({ source: 2, pin: 1 })],
      ['GET', '/cabletemp'],
    ])
  })

  it('puts the old source back and re-reads when the second write of a reassign fails', async () => {
    // Unassign lands, assign is refused: without the compensating write the
    // input would be left silently empty on the device.
    config_store.set({ ...ALL_ON, cable_temp: true })
    const assigned = UNASSIGNED_SOURCES.map((s) => (s.source === 0 ? { ...s, pin: 1, status: 0, temperature: 20 } : s))
    httpAPI.mockImplementation((method, url, body) => {
      if (method === 'GET' && url === '/cabletemp') return Promise.resolve({ supported: true, enabled: true, sources: assigned })
      if (body === JSON.stringify({ source: 2, pin: 1 })) return Promise.resolve({ msg: 'error' })
      return Promise.resolve({ msg: 'done' })
    })
    const { getByText, getAllByRole } = render(Safety)
    await fireEvent.click(getByText('config.cabletemp.title'))
    await vi.waitFor(() => expect(getByText('config.cabletemp.input1')).toBeInTheDocument())

    httpAPI.mockClear()
    await fireEvent.change(getAllByRole('combobox')[0], { target: { value: '2' } })
    await vi.waitFor(() => expect(httpAPI).toHaveBeenCalledTimes(4))
    expect(httpAPI.mock.calls.map((c) => c.slice(0, 3))).toEqual([
      ['POST', '/cabletemp', JSON.stringify({ source: 0, pin: 0 })],
      ['POST', '/cabletemp', JSON.stringify({ source: 2, pin: 1 })],
      ['POST', '/cabletemp', JSON.stringify({ source: 0, pin: 1 })],
      ['GET', '/cabletemp'],
    ])
    await vi.waitFor(() => expect(get(uistates_store).alertbox.visible).toBe(true))
  })

  it('shows the offset and panic threshold in the device unit, and writes tenths of °C', async () => {
    // A Fahrenheit charger: the reading, both cable thresholds and the
    // enclosure thresholds further down must all agree on a unit.
    config_store.set({ ...ALL_ON, cable_temp: true, temp_unit: 'f' })
    const assigned = UNASSIGNED_SOURCES.map((s) =>
      s.source === 0 ? { ...s, pin: 1, status: 0, temperature: 34.5, r25: 10000, beta: 3443, offset_c10: -5, panic_c10: 900 } : s,
    )
    httpAPI.mockImplementation((method, url) =>
      (method === 'GET' && url === '/cabletemp')
        ? Promise.resolve({ supported: true, enabled: true, sources: assigned })
        : Promise.resolve({ msg: 'done' }),
    )
    const { getByText, getAllByRole } = render(Safety)
    await fireEvent.click(getByText('config.cabletemp.title'))
    await vi.waitFor(() => expect(getByText('94.1 units.fahrenheit')).toBeInTheDocument())
    const numbers = getAllByRole('spinbutton')
    expect(numbers[2]).toHaveValue(-0.9) // offset: -0.5 °C as a difference, no +32
    expect(numbers[3]).toHaveValue(194) // panic: 90 °C
    expect(getByText('config.cabletemp.panic (units.fahrenheit)')).toBeInTheDocument()

    httpAPI.mockClear()
    await fireEvent.input(numbers[3], { target: { value: '200' } })
    await fireEvent.blur(numbers[3])
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith(
        'POST', '/cabletemp',
        JSON.stringify({ source: 0, pin: 1, r25: 10000, beta: 3443, offset_c10: -5, panic_c10: 933 }),
      )
    })
  })

  it('shows the reading and calibration fields once a source is assigned', async () => {
    config_store.set({ ...ALL_ON, cable_temp: true })
    const assigned = UNASSIGNED_SOURCES.map((s) =>
      s.source === 0 ? { ...s, pin: 1, status: 0, temperature: 34.5, r25: 10000, beta: 3443, offset_c10: 0, panic_c10: 900 } : s,
    )
    httpAPI.mockImplementation((method, url) =>
      (method === 'GET' && url === '/cabletemp')
        ? Promise.resolve({ supported: true, enabled: true, sources: assigned })
        : Promise.resolve({ msg: 'done' }),
    )
    const { getByText } = render(Safety)
    await fireEvent.click(getByText('config.cabletemp.title'))
    await vi.waitFor(() => {
      expect(getByText('config.cabletemp.reading')).toBeInTheDocument()
      expect(getByText('34.5 units.celsius')).toBeInTheDocument()
    })
  })

  it('sends the other three calibration fields unchanged when saving one', async () => {
    config_store.set({ ...ALL_ON, cable_temp: true })
    const assigned = UNASSIGNED_SOURCES.map((s) =>
      s.source === 0 ? { ...s, pin: 1, status: 0, temperature: 34.5, r25: 10000, beta: 3443, offset_c10: 0, panic_c10: 900 } : s,
    )
    httpAPI.mockImplementation((method, url) =>
      (method === 'GET' && url === '/cabletemp')
        ? Promise.resolve({ supported: true, enabled: true, sources: assigned })
        : Promise.resolve({ msg: 'done' }),
    )
    const { getByText, getAllByRole } = render(Safety)
    await fireEvent.click(getByText('config.cabletemp.title'))
    await vi.waitFor(() => expect(getByText('config.cabletemp.reading')).toBeInTheDocument())

    httpAPI.mockClear()
    const numbers = getAllByRole('spinbutton') // <input type="number">
    await fireEvent.input(numbers[0], { target: { value: '10500' } }) // r25
    await fireEvent.blur(numbers[0])
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith(
        'POST', '/cabletemp',
        JSON.stringify({ source: 0, pin: 1, r25: 10500, beta: 3443, offset_c10: 0, panic_c10: 900 }),
      )
    })
  })
})
