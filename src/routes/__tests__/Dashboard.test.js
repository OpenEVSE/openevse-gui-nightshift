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
    const { getByText, queryByRole } = render(Dashboard)
    // ChargeControls renders a locked-state box with the owner label embedded
    expect(getByText('dashboard.controls.locked_by')).toBeInTheDocument()
    // locked state hides the mode radiogroup entirely
    expect(queryByRole('radiogroup', { name: 'dashboard.mode.aria' })).not.toBeInTheDocument()
  })

  it('treats a reached charge limit as a ring reason, not a control lock', () => {
    // Limit tripped: device sleeping (254) with the limit holding the claim.
    status_store.set({ state: 254, total_day: 0, total_energy: 0 })
    claims_target_store.set({ properties: {}, claims: { state: EvseClients.limit.id } })
    limit_store.set({ type: 'soc', value: 80, auto_release: true })
    const { getByText, getByRole, queryByText } = render(Dashboard)
    // The reason shows in the ring, and the controls stay live (not locked).
    expect(getByText('dashboard.reason.limit_reached')).toBeInTheDocument()
    expect(queryByText('dashboard.controls.locked_by')).not.toBeInTheDocument()
    expect(getByRole('radiogroup', { name: 'dashboard.mode.aria' })).toBeInTheDocument()
  })

  it('clears the tripped limit when On is selected so charging resumes', async () => {
    status_store.set({ state: 254, total_day: 0, total_energy: 0 })
    claims_target_store.set({ properties: {}, claims: { state: EvseClients.limit.id } })
    limit_store.set({ type: 'soc', value: 80, auto_release: true })
    const { getByText } = render(Dashboard)
    // On forces charge; since the limit claim outranks manual, setSegment also
    // removes the limit (DELETE /limit) on top of the active override.
    await fireEvent.click(getByText('dashboard.mode.on'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('DELETE', '/limit')
    })
  })

  it('surfaces the global alert when a mode write fails', async () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    httpAPI.mockResolvedValue('error')
    const { getByText } = render(Dashboard)
    // Click the 'On' segment button directly — setSegment calls override_store.upload
    // which goes through httpAPI; the mock returns 'error' so showWriteError fires.
    await fireEvent.click(getByText('dashboard.mode.on'))
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })

  it('drives /divertmode when the Eco segment is selected', async () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    config_store.set({ max_current_soft: 48, divert_enabled: true, current_shaper_enabled: false })
    const { getByText } = render(Dashboard)
    // Click the Eco segment button in ChargeControls — setSegment('eco') releases the
    // override then POSTs divertmode=2.
    await fireEvent.click(getByText('dashboard.eco'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/divertmode', 'divertmode=2', 'text')
    })
  })

  it('uploads a disabled override when the Off segment is selected', async () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    const { getByText } = render(Dashboard)
    // setSegment('off') uploads an override with state 'disabled' and the
    // soft-max fallback current (no prior override charge_current set).
    await fireEvent.click(getByText('dashboard.mode.off'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith(
        'POST',
        '/override',
        JSON.stringify({ state: 'disabled', charge_current: 48, auto_release: false }),
      )
    })
  })

  it('shows the charge-limit bar when battery_level is present', () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 80, battery_range: 206, time_to_full_charge: 0 })
    const { getByRole } = render(Dashboard)
    expect(getByRole('slider', { name: 'dashboard.vehicle.target_aria' })).toBeInTheDocument()
  })

  it('hides the SOC bar when there is no battery_level', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    const { queryByRole } = render(Dashboard)
    expect(queryByRole('slider', { name: 'dashboard.vehicle.target_aria' })).not.toBeInTheDocument()
  })

  it('shows the SOC bar whenever battery_level is present', () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 80, battery_range: 206, time_to_full_charge: 0 })
    const { getByRole } = render(Dashboard)
    expect(getByRole('slider', { name: 'dashboard.vehicle.target_aria' })).toBeInTheDocument()
  })

  it('uploads a soc limit when the bar is committed in percent mode', async () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 90, battery_range: 206, time_to_full_charge: 0 })
    const { getByRole } = render(Dashboard)
    const slider = getByRole('slider', { name: 'dashboard.vehicle.target_aria' })
    slider.value = '85'
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/limit', JSON.stringify({ type: 'soc', value: 85, auto_release: true }))
    })
  })

  it('uploads a range limit when committed in range mode', async () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 90, battery_range: 206, time_to_full_charge: 0 })
    const { getByRole } = render(Dashboard)
    await fireEvent.click(getByRole('button', { name: 'units.km' })) // range-unit toggle button
    const slider = getByRole('slider', { name: 'dashboard.vehicle.target_aria' })
    slider.value = '50' // 50% of estMaxRange(206/0.74≈278.4) ≈ 139 km
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/limit', JSON.stringify({ type: 'range', value: 139, auto_release: true }))
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

  it('renders the ChargeControls segment group and the rate pill', () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 32000, session_energy: 0, session_elapsed: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0 })
    const { getByRole } = render(Dashboard)
    // ChargeControls renders a radiogroup for the mode segment control
    expect(getByRole('radiogroup', { name: 'dashboard.mode.aria' })).toBeInTheDocument()
    // RatePill is still present in the non-chart path
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

  it('carries the desktop two-column grid classes', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    const { container } = render(Dashboard)
    const section = container.querySelector('section')
    expect(section.className).toContain('lg:grid-cols-2')
    // two column wrappers that dissolve on mobile
    expect(container.querySelectorAll('section > [class*="max-lg:contents"]')).toHaveLength(2)
  })

  it('hides the limit clear button for a system (default) limit', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    limit_store.set({ type: 'energy', value: 10000, auto_release: false })
    const { queryByLabelText, getByText } = render(Dashboard)
    expect(getByText('dashboard.limit.label')).toBeDefined() // row renders (sanity)
    expect(queryByLabelText('dashboard.limit.clear')).not.toBeInTheDocument()
  })

  it('keeps the limit clear button for a user limit', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    limit_store.set({ type: 'energy', value: 10000, auto_release: true })
    const { getByLabelText } = render(Dashboard)
    expect(getByLabelText('dashboard.limit.clear')).toBeInTheDocument()
  })

  it('does not DELETE a system limit when forcing On past a trip', async () => {
    status_store.set({ state: 254, total_day: 0, total_energy: 0 })
    claims_target_store.set({ properties: {}, claims: { state: EvseClients.limit.id } })
    limit_store.set({ type: 'energy', value: 10000, auto_release: false })
    const { getByText } = render(Dashboard)
    await fireEvent.click(getByText('dashboard.mode.on'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalled() // the override write happened
    })
    expect(httpAPI).not.toHaveBeenCalledWith('DELETE', '/limit')
  })
})
