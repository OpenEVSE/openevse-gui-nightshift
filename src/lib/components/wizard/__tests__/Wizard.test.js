// src/lib/components/wizard/__tests__/Wizard.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

// We don't care about the queue's batching for unit tests — just resolve.
vi.mock('../../../queue.js', () => ({
  serialQueue: { add: (fn) => Promise.resolve(fn()) },
}))

// Each step pulls in real stores / form helpers / http — stub them so the
// route renders without an exploded dependency graph. vi.mock is hoisted,
// so the spy has to live inside vi.hoisted to be reachable from the factory.
const { saveParam, upload } = vi.hoisted(() => ({
  saveParam: vi.fn(() => Promise.resolve(true)),
  upload: vi.fn(() => Promise.resolve(true)),
}))
vi.mock('../../../stores/config.js', async () => {
  const { writable } = await import('svelte/store')
  const config_store = writable({ wizard_passed: false, hostname: 'openevse' })
  return { config_store: Object.assign(config_store, { saveParam, upload }) }
})
vi.mock('../../../api/httpAPI.js', () => ({
  httpAPI: vi.fn(() => Promise.resolve([])),
}))

import { writable } from 'svelte/store'
import { status_store } from '../../../stores/status.js'

import Wizard from '../../../../routes/Wizard.svelte'

beforeEach(() => {
  saveParam.mockClear()
  upload.mockClear()
  status_store.set({ ipaddress: '10.0.0.5' })
})

describe('Wizard route', () => {
  it('starts on the welcome step', () => {
    const { getByText } = render(Wizard)
    expect(getByText('wizard.welcome.title')).toBeInTheDocument()
    expect(getByText('wizard.step_count')).toBeInTheDocument()
  })

  it('advances and rewinds with Next / Previous', async () => {
    const { getByText, queryByText } = render(Wizard)
    expect(getByText('wizard.welcome.title')).toBeInTheDocument()

    await fireEvent.click(getByText('wizard.next'))
    expect(getByText('wizard.evse.title')).toBeInTheDocument()

    await fireEvent.click(getByText('wizard.previous'))
    expect(getByText('wizard.welcome.title')).toBeInTheDocument()
    expect(queryByText('wizard.previous')).toBeNull()
  })

  it('shows the max current value while the slider is dragged', async () => {
    const { getByText, getByRole } = render(Wizard)
    await fireEvent.click(getByText('wizard.next'))

    const slider = getByRole('slider')
    slider.value = '20'
    await fireEvent.input(slider)

    expect(getByText('20 A')).toBeInTheDocument()
  })

  it('holds the EVSE step and shows a comms error when the safety module is unreachable', async () => {
    // Firmware publishes evse_connected as 0 when the WiFi module can't reach
    // the EVSE controller over serial (gui-nightshift#17).
    status_store.set({ ipaddress: '10.0.0.5', evse_connected: 0 })
    const { getByText, queryByRole, queryByText } = render(Wizard)

    await fireEvent.click(getByText('wizard.next')) // -> EVSE step

    // The error is surfaced and the (untrustworthy) controls are hidden.
    expect(getByText('connection.evse_missing')).toBeInTheDocument()
    expect(queryByRole('slider')).toBeNull()
    // No bypass hint until the user actually tries to advance.
    expect(queryByText('wizard.evse.bypass_hint')).toBeNull()

    // A single Next tap can't blindly continue past setup — it holds and
    // reveals the tap-to-skip hint instead.
    await fireEvent.click(getByText('wizard.next'))
    expect(getByText('wizard.evse.title')).toBeInTheDocument()
    expect(getByText('wizard.evse.bypass_hint')).toBeInTheDocument()
  })

  it('lets a determined user tap Next three times to skip the EVSE comms block', async () => {
    status_store.set({ ipaddress: '10.0.0.5', evse_connected: 0 })
    const { getByText } = render(Wizard)

    await fireEvent.click(getByText('wizard.next')) // -> EVSE step
    await fireEvent.click(getByText('wizard.next')) // tap 1 — holds
    expect(getByText('wizard.evse.title')).toBeInTheDocument()
    await fireEvent.click(getByText('wizard.next')) // tap 2 — holds
    expect(getByText('wizard.evse.title')).toBeInTheDocument()
    await fireEvent.click(getByText('wizard.next')) // tap 3 — breaks through
    expect(getByText('wizard.wifi.title')).toBeInTheDocument()
  })

  it('resets the bypass tap count when the EVSE step is revisited', async () => {
    status_store.set({ ipaddress: '10.0.0.5', evse_connected: 0 })
    const { getByText } = render(Wizard)

    await fireEvent.click(getByText('wizard.next')) // -> EVSE step
    await fireEvent.click(getByText('wizard.next')) // tap 1
    await fireEvent.click(getByText('wizard.next')) // tap 2
    await fireEvent.click(getByText('wizard.previous')) // back to welcome — resets
    await fireEvent.click(getByText('wizard.next')) // -> EVSE step again

    // Prior taps were cleared: one tap here must not break through.
    await fireEvent.click(getByText('wizard.next')) // tap 1 of a fresh count
    expect(getByText('wizard.evse.title')).toBeInTheDocument()
  })

  it('allows advancing past the EVSE step when the controller is reachable', async () => {
    status_store.set({ ipaddress: '10.0.0.5', evse_connected: 1 })
    const { getByText, getByRole } = render(Wizard)

    await fireEvent.click(getByText('wizard.next')) // -> EVSE step
    expect(getByRole('slider')).toBeInTheDocument()

    await fireEvent.click(getByText('wizard.next')) // -> WiFi step
    expect(getByText('wizard.wifi.title')).toBeInTheDocument()
  })

  it('saves wizard_passed and stays put when finishing off the device AP', async () => {
    status_store.set({ ipaddress: '10.0.0.5' })
    const { getByText, queryByText } = render(Wizard)
    // Click Next four times to land on step 4 (firmware).
    for (let i = 0; i < 4; i++) await fireEvent.click(getByText('wizard.next'))
    await fireEvent.click(getByText('wizard.finish'))

    expect(saveParam).toHaveBeenCalledWith('wizard_passed', true)
    // No reconnect dialog when we already have a routable IP — App.svelte
    // swaps to the dashboard once wizard_passed flips.
    expect(queryByText('wizard.reconnect.title')).toBeNull()
  })

  it('shows the reconnect dialog when finishing while still on the device AP', async () => {
    status_store.set({ ipaddress: '192.168.4.1' })
    const { getByText } = render(Wizard)
    for (let i = 0; i < 4; i++) await fireEvent.click(getByText('wizard.next'))
    await fireEvent.click(getByText('wizard.finish'))

    expect(saveParam).toHaveBeenCalledWith('wizard_passed', true)
    expect(getByText('wizard.reconnect.title')).toBeInTheDocument()
  })

  it('can join a network entered manually when scanning finds nothing', async () => {
    const { getByText, getByLabelText } = render(Wizard)
    await fireEvent.click(getByText('wizard.next'))
    await fireEvent.click(getByText('wizard.next'))
    await fireEvent.click(getByText('config.network.manual'))
    await fireEvent.input(getByLabelText('config.network.ssid'), {
      target: { value: 'Hidden network' },
    })
    await fireEvent.input(getByLabelText('config.network.wifi_password'), {
      target: { value: 'secret' },
    })
    await fireEvent.click(getByText('config.network.connect'))

    await vi.waitFor(() => {
      expect(upload).toHaveBeenCalledWith({ ssid: 'Hidden network', pass: 'secret' })
    })
  })
})
