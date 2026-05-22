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
import Monitoring from '../Monitoring.svelte'

describe('Monitoring', () => {
  beforeEach(() => {
    status_store.set({ total_energy: 7523, gfcicount: 0, nogndcount: 0, stuckcount: 0, total_switches: 19 })
    config_store.set({ scale: 454, offset: 283, max_current_soft: 48 })
    claims_target_store.set({ claims: { state: 65537 }, properties: { state: 'disabled' } })
    uistates_store.setObject('error', false)
  })

  it('renders the Data tab by default with the energy group', () => {
    const { getByText } = render(Monitoring)
    expect(getByText('monitoring.group.energy')).toBeInTheDocument()
  })

  it('switches to the Safety tab when its segment is clicked', async () => {
    const { getByText } = render(Monitoring)
    await fireEvent.click(getByText('monitoring.tab.safety'))
    expect(getByText('monitoring.safety.gfci')).toBeInTheDocument()
  })

  it('switches to the Manager tab and shows the claim row', async () => {
    const { getByText } = render(Monitoring)
    await fireEvent.click(getByText('monitoring.tab.manager'))
    expect(getByText('state')).toBeInTheDocument()
  })

  it('opens on the Safety tab when the device is in a fault state', () => {
    uistates_store.setObject('error', true)
    const { getByText } = render(Monitoring)
    expect(getByText('monitoring.safety.gfci')).toBeInTheDocument()
  })
})
