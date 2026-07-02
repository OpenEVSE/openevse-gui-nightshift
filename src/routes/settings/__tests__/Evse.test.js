// src/routes/settings/__tests__/Evse.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
import { uistates_store } from '../../../lib/stores/uistates.js'
import { uisettings_store } from '../../../lib/stores/uisettings.js'
import Evse from '../Evse.svelte'

const BASE = {
  max_current_soft: 24, max_current_hard: 32, min_current_hard: 6,
  scheduler_start_window: 0, scale: 220, offset: 0, service: 0,
  pause_uses_disabled: false,
}

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
})

afterEach(() => {
  // max_energy_kwh is a persisted (localStorage-backed) store — restore the
  // default so it can't leak into order-dependent tests in other files.
  uisettings_store.update((s) => ({ ...s, max_energy_kwh: 100 }))
})

describe('EVSE page', () => {
  it('renders the max-current slider', () => {
    config_store.set({ ...BASE })
    const { getByRole } = render(Evse)
    expect(getByRole('slider')).toBeInTheDocument()
  })

  it('saves the soft current limit when the slider changes', async () => {
    config_store.set({ ...BASE })
    const { getByRole } = render(Evse)
    const slider = getByRole('slider')
    await fireEvent.change(slider, { target: { value: '16' } })
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ max_current_soft: 16 }))
  })

  it('shows the three-phase select only when the device reports it', async () => {
    config_store.set({ ...BASE })
    const { queryByText, rerender } = render(Evse)
    expect(queryByText('config.evse.threephase')).not.toBeInTheDocument()
    config_store.set({ ...BASE, is_threephase: false })
    await rerender({})
    await vi.waitFor(() => {
      expect(queryByText('config.evse.threephase')).toBeInTheDocument()
    })
  })

  it('no longer renders the default-state control (moved to Charge Manager)', () => {
    config_store.set({ ...BASE, default_state: false })
    const { queryByText } = render(Evse)
    expect(queryByText('config.evse.defaultstate')).not.toBeInTheDocument()
  })

  it('shows the front-button toggle only when the device reports it', async () => {
    config_store.set({ ...BASE })
    const { queryByText, rerender } = render(Evse)
    expect(queryByText('config.evse.front_button')).not.toBeInTheDocument()
    config_store.set({ ...BASE, button_enabled: true })
    await rerender({})
    await vi.waitFor(() => {
      expect(queryByText('config.evse.front_button')).toBeInTheDocument()
    })
  })

  it('saves the front-button toggle as a boolean', async () => {
    config_store.set({ ...BASE, button_enabled: true })
    const { getByLabelText } = render(Evse)
    await fireEvent.click(getByLabelText('config.evse.front_button'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ button_enabled: false }))
  })

  it('shows the led-brightness slider only when the device reports it', async () => {
    config_store.set({ ...BASE })
    const { queryByText, rerender } = render(Evse)
    expect(queryByText('config.evse.led_brightness')).not.toBeInTheDocument()
    config_store.set({ ...BASE, led_brightness: 128 })
    await rerender({})
    await vi.waitFor(() => {
      expect(queryByText('config.evse.led_brightness')).toBeInTheDocument()
    })
  })

  it('saves the service level as a number', async () => {
    config_store.set({ ...BASE })
    const { getAllByRole } = render(Evse)
    // service is the first <select> on the page
    const selects = getAllByRole('combobox')
    await fireEvent.change(selects[0], { target: { value: '2' } })
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ service: 2 }))
  })

  it('moves PP auto-ampacity directly under the service-level control', () => {
    config_store.set({ ...BASE, pp_auto: false })
    const { getByText } = render(Evse)
    const service = getByText('config.evse.service')
    const pp = getByText('config.evse.pp_auto')
    // service appears before pp_auto in document order
    expect(service.compareDocumentPosition(pp) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('makes the relay control card collapsible and collapsed by default', async () => {
    config_store.set({ ...BASE, relay_ac: true, zero_cross: false })
    const { getByText, queryByLabelText } = render(Evse)
    expect(queryByLabelText('config.evse.relay_ac')).toBeNull()
    await fireEvent.click(getByText('config.evse.relays'))
    expect(queryByLabelText('config.evse.relay_ac')).toBeInTheDocument()
  })

  it('shows the alert box when a save fails', async () => {
    httpAPI.mockResolvedValue('error')
    config_store.set({ ...BASE })
    const { getByRole } = render(Evse)
    await fireEvent.change(getByRole('slider'), { target: { value: '16' } })
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })

  it('no longer renders the system limit section (removed)', () => {
    config_store.set({ ...BASE, limit_default_type: '', limit_default_value: 0 })
    const { queryByText } = render(Evse)
    expect(queryByText('config.evse.system_limit')).not.toBeInTheDocument()
    expect(queryByText('config.evse.limit_type')).not.toBeInTheDocument()
    expect(queryByText('config.evse.energy_slider_max')).not.toBeInTheDocument()
  })
})
