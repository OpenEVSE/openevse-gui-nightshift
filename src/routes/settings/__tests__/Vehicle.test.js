// src/routes/settings/__tests__/Vehicle.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Vehicle from '../Vehicle.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
})

describe('Vehicle page', () => {
  it('shows MQTT topic fields when the source is MQTT', () => {
    config_store.set({ vehicle_data_src: 2 })
    const { getByText } = render(Vehicle)
    expect(getByText('config.vehicle.topic_soc')).toBeInTheDocument()
    expect(getByText('config.vehicle.topic_charge_limit')).toBeInTheDocument()
    expect(getByText('config.vehicle.topic_plugged')).toBeInTheDocument()
    expect(getByText('config.vehicle.topic_charging_state')).toBeInTheDocument()
  })

  it('saves a vehicle MQTT topic on blur', async () => {
    config_store.set({ vehicle_data_src: 2 })
    const { getByPlaceholderText } = render(Vehicle)
    const input = getByPlaceholderText('topic/plugged')
    await fireEvent.input(input, { target: { value: 'car/plugged' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ mqtt_vehicle_plugged: 'car/plugged' }))
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

  it('shows the alert box when a save fails', async () => {
    httpAPI.mockResolvedValue('error')
    config_store.set({ vehicle_data_src: 0 })
    const { getByRole } = render(Vehicle)
    await fireEvent.change(getByRole('combobox'), { target: { value: '2' } })
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })

  it('shows the Tesla login form when logged out', () => {
    config_store.set({ vehicle_data_src: 1 })
    const { getByText } = render(Vehicle)
    expect(getByText('config.vehicle.login')).toBeInTheDocument()
  })

  it('reveals the manual token fields under Advanced', async () => {
    config_store.set({ vehicle_data_src: 1 })
    const { getByText, queryByText } = render(Vehicle)
    expect(queryByText('config.vehicle.access_token')).not.toBeInTheDocument()
    await fireEvent.click(getByText('config.vehicle.advanced'))
    expect(getByText('config.vehicle.access_token')).toBeInTheDocument()
  })

  it('shows the vehicle picker and logout when credentials are present', async () => {
    httpAPI.mockImplementation((m, url) =>
      url === '/tesla/vehicles'
        ? Promise.resolve({ count: 1, vehicles: [{ id: 'v1', name: 'My Tesla' }] })
        : Promise.resolve({ msg: 'done' }),
    )
    config_store.set({
      vehicle_data_src: 1,
      tesla_access_token: 'a', tesla_refresh_token: 'r',
      tesla_created_at: 1700000000, tesla_expires_in: 3600,
    })
    const { getByText } = render(Vehicle)
    expect(getByText('config.vehicle.logout')).toBeInTheDocument()
    await vi.waitFor(() => expect(getByText('config.vehicle.select_vehicle')).toBeInTheDocument())
  })

  it('calls the login endpoint and saves tokens on success', async () => {
    httpAPI.mockImplementation((m, url) => {
      if (url === 'https://auth.openevse.com/login')
        return Promise.resolve({ ok: true, access_token: 'a', refresh_token: 'r', created_at: 1700000000, expires_in: 3600 })
      return Promise.resolve({ msg: 'done' })
    })
    config_store.set({ vehicle_data_src: 1 })
    const { getByLabelText, getByText } = render(Vehicle)
    await fireEvent.input(getByLabelText('config.vehicle.username'), { target: { value: 'user@example.com' } })
    await fireEvent.input(getByLabelText('config.vehicle.password'), { target: { value: 'secret' } })
    await fireEvent.click(getByText('config.vehicle.login'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith(
        'POST',
        'https://auth.openevse.com/login',
        JSON.stringify({ username: 'user@example.com', password: 'secret' }),
      )
    })
  })

  it('shows login_failed when the login endpoint returns ok: false', async () => {
    httpAPI.mockImplementation((m, url) => {
      if (url === 'https://auth.openevse.com/login')
        return Promise.resolve({ ok: false })
      return Promise.resolve({ msg: 'done' })
    })
    config_store.set({ vehicle_data_src: 1 })
    const { getByLabelText, getByText } = render(Vehicle)
    await fireEvent.input(getByLabelText('config.vehicle.username'), { target: { value: 'user@example.com' } })
    await fireEvent.input(getByLabelText('config.vehicle.password'), { target: { value: 'wrong' } })
    await fireEvent.click(getByText('config.vehicle.login'))
    await vi.waitFor(() => {
      expect(getByText('config.vehicle.login_failed')).toBeInTheDocument()
    })
  })
})
