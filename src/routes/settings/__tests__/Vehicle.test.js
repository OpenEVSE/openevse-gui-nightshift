// src/routes/settings/__tests__/Vehicle.test.js
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
import Vehicle from '../Vehicle.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
})

describe('Vehicle page', () => {
  it('shows MQTT topic fields when the source is MQTT', () => {
    config_store.set({ vehicle_data_src: 2 })
    const { getByText } = render(Vehicle)
    expect(getByText('config.vehicle.topic_soc')).toBeInTheDocument()
  })

  it('shows Tesla token fields when the source is Tesla', () => {
    config_store.set({ vehicle_data_src: 1 })
    const { getByText } = render(Vehicle)
    expect(getByText('config.vehicle.access_token')).toBeInTheDocument()
  })

  it('shows the HTTP info block when the source is HTTP', () => {
    config_store.set({ vehicle_data_src: 3 })
    const { getByText } = render(Vehicle)
    expect(getByText('config.vehicle.http_info')).toBeInTheDocument()
  })

  it('shows no integration fields when the source is None', () => {
    config_store.set({ vehicle_data_src: 0 })
    const { queryByText } = render(Vehicle)
    expect(queryByText('config.vehicle.topic_soc')).not.toBeInTheDocument()
    expect(queryByText('config.vehicle.access_token')).not.toBeInTheDocument()
  })

  it('saves the data source as a number', async () => {
    config_store.set({ vehicle_data_src: 0 })
    const { getByRole } = render(Vehicle)
    await fireEvent.change(getByRole('combobox'), { target: { value: '2' } })
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ vehicle_data_src: 2 }))
  })
})
