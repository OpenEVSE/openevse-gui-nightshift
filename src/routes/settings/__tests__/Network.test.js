// src/routes/settings/__tests__/Network.test.js
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
import Network from '../Network.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ mode: 'STA', ipaddress: '10.0.0.5', macaddress: 'AA:BB' })
  config_store.set({ hostname: 'openevse-1', wizard_passed: false })
})

describe('Network page', () => {
  it('shows read-only network status', () => {
    const { getByText } = render(Network)
    expect(getByText('10.0.0.5')).toBeInTheDocument()
    expect(getByText('AA:BB')).toBeInTheDocument()
  })

  it('saves the hostname on blur', async () => {
    const { getByDisplayValue } = render(Network)
    const input = getByDisplayValue('openevse-1')
    await fireEvent.input(input, { target: { value: 'garage' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ hostname: 'garage' }))
  })

  it('hides the AP block until the setup wizard has passed', () => {
    const { queryByText } = render(Network)
    expect(queryByText('config.network.apssid')).not.toBeInTheDocument()
  })

  it('shows the AP block when wizard_passed', () => {
    config_store.set({ hostname: 'openevse-1', wizard_passed: true, ap_ssid: 'ap', ap_pass: '' })
    const { getByText } = render(Network)
    expect(getByText('config.network.apssid')).toBeInTheDocument()
  })

  it('surfaces the write-error alert on a failed save', async () => {
    httpAPI.mockResolvedValue('error')
    const { getByDisplayValue } = render(Network)
    const input = getByDisplayValue('openevse-1')
    await fireEvent.input(input, { target: { value: 'x' } })
    await fireEvent.blur(input)
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })

  it('lists scanned networks strongest-first', async () => {
    httpAPI.mockImplementation((m, url) =>
      url === '/scan'
        ? Promise.resolve([
            { ssid: 'Weak', rssi: -80 },
            { ssid: 'Strong', rssi: -45, encryption: 'wpa2' },
          ])
        : Promise.resolve({ msg: 'done' }),
    )
    const { getByText } = render(Network)
    await fireEvent.click(getByText('config.network.scan'))
    await vi.waitFor(() => {
      expect(getByText('Strong')).toBeInTheDocument()
      expect(getByText('Weak')).toBeInTheDocument()
    })
  })

  it('joins a picked network with ssid + pass', async () => {
    httpAPI.mockImplementation((m, url) =>
      url === '/scan'
        ? Promise.resolve([{ ssid: 'Home', rssi: -50, encryption: 'wpa2' }])
        : Promise.resolve({ msg: 'done' }),
    )
    const { getByText, getByLabelText } = render(Network)
    await fireEvent.click(getByText('config.network.scan'))
    await vi.waitFor(() => getByText('Home'))
    await fireEvent.click(getByText('Home'))
    const pass = getByLabelText('config.network.wifi_password')
    await fireEvent.input(pass, { target: { value: 'secret' } })
    await fireEvent.click(getByText('config.network.connect'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith(
        'POST', '/config', JSON.stringify({ ssid: 'Home', pass: 'secret' }),
      )
    })
  })

  it('joins a network entered manually without a scan result', async () => {
    const { getByText, getByLabelText } = render(Network)
    await fireEvent.click(getByText('config.network.manual'))
    await fireEvent.input(getByLabelText('config.network.ssid'), {
      target: { value: 'Hidden network' },
    })
    await fireEvent.input(getByLabelText('config.network.wifi_password'), {
      target: { value: 'secret' },
    })
    await fireEvent.click(getByText('config.network.connect'))

    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith(
        'POST', '/config', JSON.stringify({ ssid: 'Hidden network', pass: 'secret' }),
      )
    })
  })
})
