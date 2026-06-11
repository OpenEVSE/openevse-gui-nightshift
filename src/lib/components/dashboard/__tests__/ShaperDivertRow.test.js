import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'

const { status, config } = vi.hoisted(() => {
  const { writable } = require('svelte/store')
  return { status: writable({}), config: writable({}) }
})

vi.mock('../../../stores/status.js', () => ({ status_store: status }))
vi.mock('../../../stores/config.js', () => ({ config_store: config }))

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ShaperDivertRow from '../ShaperDivertRow.svelte'

describe('ShaperDivertRow', () => {
  beforeEach(() => {
    status.set({})
    config.set({})
  })

  it('renders nothing when neither shaper nor divert is enabled', () => {
    const { container } = render(ShaperDivertRow)
    expect(container.textContent.trim()).toBe('')
  })

  it('shows house load and available current when the shaper is enabled', () => {
    config.set({ current_shaper_enabled: true })
    status.set({ shaper_live_pwr: 4200, shaper_cur: 24, shaper_updated: true })
    const { getByText, queryByText } = render(ShaperDivertRow)
    expect(getByText('dashboard.flows.house_load')).toBeInTheDocument()
    expect(getByText('4200 W')).toBeInTheDocument()
    expect(getByText('24 A')).toBeInTheDocument()
    expect(queryByText('config.shaper.stale')).toBeNull()
  })

  it('flags stale shaper data', () => {
    config.set({ current_shaper_enabled: true })
    status.set({ shaper_live_pwr: 0, shaper_cur: 0, shaper_updated: false })
    const { getByText } = render(ShaperDivertRow)
    expect(getByText('config.shaper.stale')).toBeInTheDocument()
  })

  it('shows solar production and charge rate for divert type 0', () => {
    config.set({ divert_enabled: true, divert_type: 0 })
    status.set({ solar: 3200, charge_rate: 32 })
    const { getByText, queryByText } = render(ShaperDivertRow)
    expect(getByText('dashboard.flows.solar')).toBeInTheDocument()
    expect(getByText('3200 W')).toBeInTheDocument()
    expect(getByText('32 A')).toBeInTheDocument()
    expect(queryByText('dashboard.flows.grid')).toBeNull()
  })

  it('shows grid import/export for divert type 1', () => {
    config.set({ divert_enabled: true, divert_type: 1 })
    status.set({ grid_ie: -1500, charge_rate: 16 })
    const { getByText } = render(ShaperDivertRow)
    expect(getByText('dashboard.flows.grid')).toBeInTheDocument()
    expect(getByText('-1500 W')).toBeInTheDocument()
  })

  it('shows both rows when both features are enabled', () => {
    config.set({ current_shaper_enabled: true, divert_enabled: true, divert_type: 0 })
    status.set({ shaper_live_pwr: 260, shaper_cur: 40, shaper_updated: true, solar: 900, charge_rate: 6 })
    const { getByText } = render(ShaperDivertRow)
    expect(getByText('dashboard.flows.house_load')).toBeInTheDocument()
    expect(getByText('dashboard.flows.solar')).toBeInTheDocument()
  })
})
