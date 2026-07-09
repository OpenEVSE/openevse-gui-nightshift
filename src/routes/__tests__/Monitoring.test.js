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

  it('shows the Energy tab even with dev features off (ungated)', () => {
    const { getByText } = render(Monitoring)
    expect(getByText('monitoring.tab.energy')).toBeInTheDocument()
    // Data remains the default landing — its energy metric group is shown.
    expect(getByText('monitoring.group.energy')).toBeInTheDocument()
  })

  it('shows the live energy view when the Energy tab is selected', async () => {
    const { getByText } = render(Monitoring)
    await fireEvent.click(getByText('monitoring.tab.energy'))
    expect(getByText('monitoring.energy.live')).toBeInTheDocument()
  })

  it('switches to the Safety tab when its segment is clicked', async () => {
    const { getByText } = render(Monitoring)
    await fireEvent.click(getByText('monitoring.tab.safety'))
    expect(getByText('monitoring.safety.gfci')).toBeInTheDocument()
  })

  it('no longer shows the Manager tab (removed)', () => {
    const { queryByText } = render(Monitoring)
    expect(queryByText('monitoring.tab.manager')).not.toBeInTheDocument()
  })

  it('opens on the Safety tab when the device is in a fault state', () => {
    uistates_store.setObject('error', true)
    const { getByText } = render(Monitoring)
    expect(getByText('monitoring.safety.gfci')).toBeInTheDocument()
  })

  it('inserts the Vehicle group only when the device reports vehicle data', () => {
    // default fixture (no battery data) — no Vehicle group on the Data tab
    const plain = render(Monitoring)
    expect(plain.queryByText('monitoring.group.vehicle')).not.toBeInTheDocument()
    plain.unmount()

    // with battery data — the Vehicle group appears
    status_store.set({ total_energy: 7523, battery_level: 80, gfcicount: 0, nogndcount: 0, stuckcount: 0 })
    const withVehicle = render(Monitoring)
    expect(withVehicle.getByText('monitoring.group.vehicle')).toBeInTheDocument()
  })
})
