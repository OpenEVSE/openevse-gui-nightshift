import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'

const { loadRaw, loadNewer, loadDaily, loadMonthly, loadAnnual } = vi.hoisted(() => ({
  loadRaw: vi.fn(async () => true),
  loadNewer: vi.fn(async () => true),
  loadDaily: vi.fn(async () => true),
  loadMonthly: vi.fn(async () => true),
  loadAnnual: vi.fn(async () => true),
}))

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

vi.mock('../../../stores/energy.js', async () => {
  const { writable } = await import('svelte/store')
  const store = writable({
    raw: { samples: [], historical: false, noOlder: false, before: 0 },
    daily: [], monthly: [], annual: [],
    loading: { raw: false, daily: false, monthly: false, annual: false },
    error:   { raw: false, daily: false, monthly: false, annual: false },
  })
  return {
    energy_store: { ...store, loadRaw, loadNewer, loadDaily, loadMonthly, loadAnnual },
    __store: store,
  }
})

// Stub chart components — they require canvas
vi.mock('../../charts/EnergyLiveChart.svelte', async () => {
  const { default: Stub } = await import('./_stub.svelte')
  return { default: Stub }
})
vi.mock('../../charts/EnergySummaryChart.svelte', async () => {
  const { default: Stub } = await import('./_stub.svelte')
  return { default: Stub }
})

import EnergyTab from '../EnergyTab.svelte'

describe('EnergyTab', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('loads raw on mount (live is the default view)', () => {
    render(EnergyTab)
    expect(loadRaw).toHaveBeenCalledTimes(1)
  })

  it('switches view and calls the matching loader', async () => {
    render(EnergyTab)
    await fireEvent.click(screen.getByRole('tab', { name: /daily/i }))
    expect(loadDaily).toHaveBeenCalled()
    await fireEvent.click(screen.getByRole('tab', { name: /monthly/i }))
    expect(loadMonthly).toHaveBeenCalled()
    await fireEvent.click(screen.getByRole('tab', { name: /annual/i }))
    expect(loadAnnual).toHaveBeenCalled()
  })
  it('disables Newer and Current in the live view', () => {
    render(EnergyTab)
    expect(screen.getByText('monitoring.energy.newer')).toBeDisabled()
    expect(screen.getByText('monitoring.energy.current')).toBeDisabled()
  })

  it('Newer pages forward and Current returns to live when viewing history', async () => {
    const { __store } = await import('../../../stores/energy.js')
    __store.update((s) => ({ ...s, raw: { samples: [{ ts: 1 }], historical: true, noOlder: false, before: 100 } }))
    render(EnergyTab)
    loadRaw.mockClear()
    await fireEvent.click(screen.getByText('monitoring.energy.newer'))
    expect(loadNewer).toHaveBeenCalledTimes(1)
    await fireEvent.click(screen.getByText('monitoring.energy.current'))
    expect(loadRaw).toHaveBeenCalledWith()
  })
})
