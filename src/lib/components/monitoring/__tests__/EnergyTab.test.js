import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'

const { loadRaw, loadDaily, loadMonthly, loadAnnual } = vi.hoisted(() => ({
  loadRaw: vi.fn(async () => true),
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
    raw: { samples: [], historical: false, noOlder: false },
    daily: [], monthly: [], annual: [],
    loading: { raw: false, daily: false, monthly: false, annual: false },
    error:   { raw: false, daily: false, monthly: false, annual: false },
  })
  return {
    energy_store: { ...store, loadRaw, loadDaily, loadMonthly, loadAnnual },
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
})
