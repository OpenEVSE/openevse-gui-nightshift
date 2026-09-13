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
})

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
    expect(queryByLabelText('config.safety.cable_temp')).toBeNull()
    await fireEvent.click(getByText('config.cabletemp.title'))
    expect(getByLabelText('config.safety.cable_temp')).toBeInTheDocument()
  })

  it('saves the enable toggle to /config', async () => {
    config_store.set({ ...ALL_ON, cable_temp: false })
    const { getByText, getByLabelText } = render(Safety)
    await fireEvent.click(getByText('config.cabletemp.title'))
    await fireEvent.click(getByLabelText('config.safety.cable_temp'))
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
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/cabletemp', JSON.stringify({ source: 0, pin: 0 }))
      expect(httpAPI).toHaveBeenCalledWith('POST', '/cabletemp', JSON.stringify({ source: 2, pin: 1 }))
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
