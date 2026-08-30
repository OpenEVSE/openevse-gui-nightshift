import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({})) }))

import { status_store } from '../../lib/stores/status.js'
import { config_store } from '../../lib/stores/config.js'
import { claims_target_store } from '../../lib/stores/claims_target.js'
import { uistates_store } from '../../lib/stores/uistates.js'
import { uisettings_store } from '../../lib/stores/uisettings.js'
import Monitoring from '../Monitoring.svelte'

describe('Monitoring', () => {
  beforeEach(() => {
    status_store.set({ total_energy: 7523, gfcicount: 0, nogndcount: 0, stuckcount: 0, total_switches: 19 })
    config_store.set({ scale: 454, offset: 283, max_current_soft: 48 })
    claims_target_store.set({ claims: { state: 65537 }, properties: { state: 'disabled' } })
    uistates_store.setObject('error', false)
    uisettings_store.update((s) => ({ ...s, dev_features: false }))
  })

  it('lands on the Energy tab by default', () => {
    const { getByText } = render(Monitoring)
    expect(getByText('monitoring.tab.energy')).toBeInTheDocument()
    expect(getByText('monitoring.energy.live')).toBeInTheDocument()
  })

  it('shows the Data tab metrics when its segment is clicked', async () => {
    const { getByText } = render(Monitoring)
    await fireEvent.click(getByText('monitoring.tab.data'))
    expect(getByText('monitoring.group.energy')).toBeInTheDocument()
  })

  it('switches to the Health tab when its segment is clicked', async () => {
    const { getByText } = render(Monitoring)
    await fireEvent.click(getByText('monitoring.tab.health'))
    expect(getByText('monitoring.safety.gfci')).toBeInTheDocument()
  })

  it('no longer shows the Manager tab (removed)', () => {
    const { queryByText } = render(Monitoring)
    expect(queryByText('monitoring.tab.manager')).not.toBeInTheDocument()
  })

  it('opens on the Health tab when the device is in a fault state', () => {
    uistates_store.setObject('error', true)
    const { getByText } = render(Monitoring)
    expect(getByText('monitoring.safety.gfci')).toBeInTheDocument()
  })

  it('inserts the Vehicle group only when the device reports vehicle data', async () => {
    // default fixture (no battery data) — no Vehicle group on the Data tab
    const plain = render(Monitoring)
    await fireEvent.click(plain.getByText('monitoring.tab.data'))
    expect(plain.queryByText('monitoring.group.vehicle')).not.toBeInTheDocument()
    plain.unmount()

    // with battery data — the Vehicle group appears
    status_store.set({ total_energy: 7523, battery_level: 80, gfcicount: 0, nogndcount: 0, stuckcount: 0 })
    const withVehicle = render(Monitoring)
    await fireEvent.click(withVehicle.getByText('monitoring.tab.data'))
    expect(withVehicle.getByText('monitoring.group.vehicle')).toBeInTheDocument()
  })

  it('does not render the Relay Health section when the controller lacks RELAY_HEALTH', async () => {
    const { getByText, queryByText } = render(Monitoring)
    await fireEvent.click(getByText('monitoring.tab.health'))
    expect(queryByText('monitoring.health.relay.title')).not.toBeInTheDocument()
  })

  it('renders the Relay Health section when the config reports it', async () => {
    config_store.set({
      scale: 454, offset: 283, max_current_soft: 48,
      relay_life_pct: 72, relay_cold_open_count: 5, relay_elec_damage_x1e6: 0,
      relay_transit_drift_warning: false, relay_thermal_warning_level: 0,
      relay_stuck_recovery_count: 0,
    })
    const { getByText } = render(Monitoring)
    await fireEvent.click(getByText('monitoring.tab.health'))
    expect(getByText('monitoring.health.relay.title')).toBeInTheDocument()
  })
})
