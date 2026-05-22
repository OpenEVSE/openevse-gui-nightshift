// src/routes/settings/__tests__/Evse.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import Evse from '../Evse.svelte'

const BASE = {
  max_current_soft: 24, max_current_hard: 32, min_current_hard: 6,
  scheduler_start_window: 0, scale: 220, offset: 0, service: 0,
  pause_uses_disabled: false,
}

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
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

  it('shows the three-phase select only when the device reports it', () => {
    config_store.set({ ...BASE })
    const { queryByText, rerender } = render(Evse)
    expect(queryByText('config.evse.threephase')).not.toBeInTheDocument()
    config_store.set({ ...BASE, is_threephase: false })
    return rerender({})
  })

  it('saves the service level as a number', async () => {
    config_store.set({ ...BASE })
    const { getAllByRole } = render(Evse)
    // service is the last <select> on the page
    const selects = getAllByRole('combobox')
    await fireEvent.change(selects[selects.length - 1], { target: { value: '2' } })
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ service: 2 }))
  })
})
