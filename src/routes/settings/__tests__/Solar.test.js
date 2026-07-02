// src/routes/settings/__tests__/Solar.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { status_store } from '../../../lib/stores/status.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Solar from '../Solar.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ solar: 0, grid_ie: 0, charge_rate: 0 })
})

describe('Solar page', () => {
  it('shows the tuning settings expanded by default (no enable switch)', () => {
    config_store.set({ divert_enabled: false })
    const { getByText, queryByText } = render(Solar)
    expect(getByText('config.solar.ratio')).toBeInTheDocument()
    expect(queryByText('config.solar.enable')).not.toBeInTheDocument()
    // No "eco mode on power-up" switch either.
    expect(queryByText('config.solar.default_mode')).not.toBeInTheDocument()
  })

  it('links to the Charge Manager to enable/schedule self-production', () => {
    config_store.set({ divert_enabled: false })
    const { getByText } = render(Solar)
    const link = getByText('config.add_in_charge_manager', { exact: false }).closest('a')
    expect(link).toHaveAttribute('href', '#/schedule')
  })

  it('shows the production topic for divert type 0', () => {
    config_store.set({ divert_enabled: true, divert_type: 0 })
    const { getByText, queryByText } = render(Solar)
    expect(getByText('config.solar.feed_production')).toBeInTheDocument()
    expect(queryByText('config.solar.feed_grid')).not.toBeInTheDocument()
  })

  it('shows the grid topic for divert type 1', () => {
    config_store.set({ divert_enabled: true, divert_type: 1 })
    const { getByText } = render(Solar)
    expect(getByText('config.solar.feed_grid')).toBeInTheDocument()
  })

  it('shows the Home Battery MQTT section even when divert is disabled', () => {
    config_store.set({ divert_enabled: false })
    const { getByText, getByPlaceholderText } = render(Solar)
    expect(getByText('config.solar.home_battery')).toBeInTheDocument()
    expect(getByPlaceholderText('topic/home_battery_soc')).toBeInTheDocument()
    expect(getByPlaceholderText('topic/home_battery_power')).toBeInTheDocument()
  })

  it('saves a home-battery MQTT topic on blur', async () => {
    config_store.set({ divert_enabled: false })
    const { getByPlaceholderText } = render(Solar)
    const input = getByPlaceholderText('topic/home_battery_soc')
    await fireEvent.input(input, { target: { value: 'home/battery/soc' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ mqtt_home_battery_soc: 'home/battery/soc' }))
  })

  it('shows live home-battery readings when present', () => {
    config_store.set({ divert_enabled: false })
    status_store.set({ solar: 0, grid_ie: 0, charge_rate: 0, home_battery_soc: 82, home_battery_power: -1200 })
    const { getByText } = render(Solar)
    expect(getByText('config.solar.battery_soc')).toBeInTheDocument()
    expect(getByText('config.solar.battery_power')).toBeInTheDocument()
  })

  it('saves all four params when a preset is chosen', async () => {
    config_store.set({ divert_enabled: true, divert_type: 0, divert_PV_ratio: 2 })
    const { getByText } = render(Solar)
    await fireEvent.click(getByText('config.solar.preset_no_import'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({
        divert_attack_smoothing_time: 300, divert_decay_smoothing_time: 20,
        divert_min_charge_time: 600, divert_PV_ratio: 1.1,
      }))
    })
  })
})
