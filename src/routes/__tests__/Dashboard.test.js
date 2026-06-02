import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({})) }))

import { httpAPI } from '../../lib/api/httpAPI.js'
import { status_store } from '../../lib/stores/status.js'
import { config_store } from '../../lib/stores/config.js'
import { claims_target_store } from '../../lib/stores/claims_target.js'
import { override_store } from '../../lib/stores/override.js'
import { uistates_store } from '../../lib/stores/uistates.js'
import { limit_store } from '../../lib/stores/limit.js'
import { EvseClients } from '../../lib/vars.js'
import Dashboard from '../Dashboard.svelte'

describe('Dashboard', () => {
  beforeEach(() => {
    config_store.set({ max_current_soft: 48, divert_enabled: false, current_shaper_enabled: false })
    claims_target_store.set({ properties: {}, claims: { state: null } })
    override_store.set(undefined)
    uistates_store.resetAlertBox()
    httpAPI.mockReset()
    httpAPI.mockResolvedValue({})
    limit_store.set({ type: 'none', value: 0, auto_release: true })
  })

  it('renders the charging composition when state is 3', () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 32000, session_energy: 12300, session_elapsed: 6129, temp: 427, pilot: 32, max_current: 48 })
    const { getByText } = render(Dashboard)
    expect(getByText('dashboard.status.charging')).toBeInTheDocument()
  })

  it('renders the idle composition when state is 1', () => {
    status_store.set({ state: 1, total_day: 3.2, total_energy: 7523 })
    const { getByText } = render(Dashboard)
    expect(getByText('dashboard.ring.ready')).toBeInTheDocument()
  })

  it('locks the mode pill to the claim owner (RFID)', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    claims_target_store.set({ properties: {}, claims: { state: EvseClients.rfid.id } })
    const { getByText, queryByText } = render(Dashboard)
    expect(getByText('RFID')).toBeInTheDocument()
    // locked pill renders no popover options
    expect(queryByText('dashboard.mode.off')).not.toBeInTheDocument()
  })

  it('surfaces the global alert when a mode write fails', async () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    httpAPI.mockResolvedValue('error')
    const { getByText, getByRole } = render(Dashboard)
    await fireEvent.click(getByRole('button', { name: 'dashboard.mode.aria' }))
    await fireEvent.click(getByText('dashboard.mode.on'))
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })

  it('drives /divertmode when the Eco toggle is switched on', async () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    config_store.set({ max_current_soft: 48, divert_enabled: true, current_shaper_enabled: false })
    const { getByLabelText } = render(Dashboard)
    await fireEvent.click(getByLabelText('dashboard.eco'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/divertmode', 'divertmode=2', 'text')
    })
  })

  it('shows the vehicle SOC bar when battery_level is present', () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 80, battery_range: 206, time_to_full_charge: 0 })
    const { getByText, getByRole } = render(Dashboard)
    expect(getByText('74%')).toBeInTheDocument()
    expect(getByRole('slider', { name: 'dashboard.vehicle.target_aria' })).toBeInTheDocument()
  })

  it('hides the SOC bar when there is no battery_level', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    const { queryByRole } = render(Dashboard)
    expect(queryByRole('slider', { name: 'dashboard.vehicle.target_aria' })).not.toBeInTheDocument()
  })

  it('uploads an soc limit when the SOC target is committed', async () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 90, battery_range: 206, time_to_full_charge: 0 })
    const { getByRole } = render(Dashboard)
    const slider = getByRole('slider', { name: 'dashboard.vehicle.target_aria' })
    slider.value = '85'
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/limit', JSON.stringify({ type: 'soc', value: 85, auto_release: true }))
    })
  })

  it('clears the soc limit when the knob is dragged up to the vehicle limit', async () => {
    limit_store.set({ type: 'soc', value: 60, auto_release: true })
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 80, battery_range: 206, time_to_full_charge: 0 })
    const { getByRole } = render(Dashboard)
    const slider = getByRole('slider', { name: 'dashboard.vehicle.target_aria' })
    slider.value = '80' // at the vehicle limit → no limit
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('DELETE', '/limit')
    })
  })

  it('renders the mode and rate pills instead of the old rows', () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 32000, session_energy: 0, session_elapsed: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0 })
    const { getByRole } = render(Dashboard)
    expect(getByRole('button', { name: 'dashboard.mode.aria' })).toBeInTheDocument()
    expect(getByRole('button', { name: 'dashboard.rate.aria' })).toBeInTheDocument()
  })

  it('writes the charge rate from the rate pill', async () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 32000, session_energy: 0, session_elapsed: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0 })
    const { getByRole } = render(Dashboard)
    await fireEvent.click(getByRole('button', { name: 'dashboard.rate.aria' }))
    const slider = getByRole('slider', { name: 'dashboard.rate.aria' })
    slider.value = '20'
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/override', expect.stringContaining('"charge_current":20'))
    })
  })
})
