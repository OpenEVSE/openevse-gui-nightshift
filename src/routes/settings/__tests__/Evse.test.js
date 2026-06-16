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

  it('shows the default-state select only when the device reports it', async () => {
    config_store.set({ ...BASE })
    const { queryByText, rerender } = render(Evse)
    expect(queryByText('config.evse.defaultstate')).not.toBeInTheDocument()
    config_store.set({ ...BASE, default_state: false })
    await rerender({})
    await vi.waitFor(() => {
      expect(queryByText('config.evse.defaultstate')).toBeInTheDocument()
    })
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
    // service is the first <select> on the page; system-limit is the last
    const selects = getAllByRole('combobox')
    await fireEvent.change(selects[0], { target: { value: '2' } })
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ service: 2 }))
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

  it('renders the system limit section', () => {
    config_store.set({ ...BASE, limit_default_type: '', limit_default_value: 0 })
    const { getByText } = render(Evse)
    expect(getByText('config.evse.system_limit')).toBeInTheDocument()
    expect(getByText('config.evse.limit_type')).toBeInTheDocument()
  })

  it('saves type with a zeroed value when picking a system limit type', async () => {
    config_store.set({ ...BASE, limit_default_type: '', limit_default_value: 0 })
    const { getAllByRole } = render(Evse)
    const selects = getAllByRole('combobox')
    const typeSelect = selects[selects.length - 1] // system-limit select is the page's last combobox
    await fireEvent.change(typeSelect, { target: { value: 'energy' } })
    expect(httpAPI).toHaveBeenCalledWith(
      'POST', '/config',
      JSON.stringify({ limit_default_type: 'energy', limit_default_value: 0 }),
    )
  })

  it('shows the energy value in kWh and saves it in Wh', async () => {
    config_store.set({ ...BASE, limit_default_type: 'energy', limit_default_value: 10000 })
    const { getByDisplayValue } = render(Evse)
    const input = getByDisplayValue('10') // 10000 Wh shown as 10 kWh
    await fireEvent.input(input, { target: { value: '12' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith(
      'POST', '/config',
      JSON.stringify({ limit_default_value: 12000 }),
    )
  })

  it('saves a non-energy value unconverted', async () => {
    config_store.set({ ...BASE, limit_default_type: 'time', limit_default_value: 120 })
    const { getByDisplayValue } = render(Evse)
    const input = getByDisplayValue('120')
    await fireEvent.input(input, { target: { value: '90' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith(
      'POST', '/config',
      JSON.stringify({ limit_default_value: 90 }),
    )
  })

  it('removes the system limit by writing type none', async () => {
    config_store.set({ ...BASE, limit_default_type: 'energy', limit_default_value: 10000 })
    const { getAllByRole } = render(Evse)
    const selects = getAllByRole('combobox')
    await fireEvent.change(selects[selects.length - 1], { target: { value: 'none' } })
    expect(httpAPI).toHaveBeenCalledWith(
      'POST', '/config',
      JSON.stringify({ limit_default_type: 'none' }),
    )
  })

  it('hides the value field when no system limit type is set', () => {
    config_store.set({ ...BASE, limit_default_type: '', limit_default_value: 0 })
    const { queryByText } = render(Evse)
    expect(queryByText('config.evse.limit_value')).not.toBeInTheDocument()
  })

  it('saves the energy-slider max to local UI settings (kWh, not the device)', async () => {
    config_store.set({ ...BASE, limit_default_type: '', limit_default_value: 0 })
    uisettings_store.update((s) => ({ ...s, max_energy_kwh: 100 }))
    const { getByDisplayValue } = render(Evse)
    const input = getByDisplayValue('100')
    await fireEvent.input(input, { target: { value: '40' } })
    await fireEvent.blur(input)
    expect(get(uisettings_store).max_energy_kwh).toBe(40)
    // It's a local preference — nothing goes to the device.
    expect(httpAPI).not.toHaveBeenCalled()
  })

  it('caps an over-large energy-slider max at the hard ceiling', async () => {
    config_store.set({ ...BASE, limit_default_type: '', limit_default_value: 0 })
    uisettings_store.update((s) => ({ ...s, max_energy_kwh: 100 }))
    const { getByDisplayValue } = render(Evse)
    const input = getByDisplayValue('100')
    await fireEvent.input(input, { target: { value: '100000' } })
    await fireEvent.blur(input)
    expect(get(uisettings_store).max_energy_kwh).toBe(500)
  })
})
