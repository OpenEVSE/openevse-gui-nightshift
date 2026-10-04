// src/routes/settings/__tests__/ShellyLnm.test.js
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
import { status_store } from '../../../lib/stores/status.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import ShellyLnm from '../ShellyLnm.svelte'

const base = {
  shelly_lnm_enabled: true,
  shelly_lnm_addr: '239.255.55.55',
  shelly_lnm_port: 5555,
  shelly_lnm_power_field: 'act_power',
  shelly_lnm_voltage_field: 'voltage',
  shelly_lnm_device: '',
}

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  config_store.set({ ...base })
  status_store.set({ shelly_lnm_listening: 1, shelly_lnm_data_age: 900, shelly_lnm_power: -1234.4, shelly_lnm_voltage: 238.26 })
})

describe('Shelly LNM page', () => {
  it('shows only the enable switch while disabled', () => {
    config_store.set({ ...base, shelly_lnm_enabled: false })
    const { getByText, queryByText } = render(ShellyLnm)
    expect(getByText('config.shellylnm.enable')).toBeInTheDocument()
    expect(queryByText('config.shellylnm.addr')).not.toBeInTheDocument()
    expect(queryByText('config.shellylnm.listening')).not.toBeInTheDocument()
  })

  it('enables the listener through /config', async () => {
    config_store.set({ ...base, shelly_lnm_enabled: false })
    const { getByRole } = render(ShellyLnm)
    await fireEvent.click(getByRole('switch'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ shelly_lnm_enabled: true }))
  })

  it('shows listener state, data age and the latest readings', () => {
    const { getByText } = render(ShellyLnm)
    expect(getByText('config.shellylnm.listening')).toBeInTheDocument()
    expect(getByText('900 ms')).toBeInTheDocument()
    expect(getByText('-1234 W')).toBeInTheDocument()
    expect(getByText('238.3 V')).toBeInTheDocument()
  })

  it('treats the firmware "never received" age and null readings as no data', () => {
    status_store.set({ shelly_lnm_listening: 0, shelly_lnm_data_age: 4294967295, shelly_lnm_power: null, shelly_lnm_voltage: null })
    const { getByText, queryByText, getAllByText } = render(ShellyLnm)
    expect(getByText('config.shellylnm.not_listening')).toBeInTheDocument()
    expect(queryByText('4294967s')).not.toBeInTheDocument()
    expect(getAllByText('—')).toHaveLength(3)
  })

  it('saves the multicast address on blur', async () => {
    const { getByDisplayValue } = render(ShellyLnm)
    const input = getByDisplayValue('239.255.55.55')
    await fireEvent.input(input, { target: { value: '239.255.55.56' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ shelly_lnm_addr: '239.255.55.56' }))
  })

  it('saves the power field selection', async () => {
    const { getByDisplayValue } = render(ShellyLnm)
    const select = getByDisplayValue(/^act_power/)
    await fireEvent.change(select, { target: { value: 'total_act_power' } })
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ shelly_lnm_power_field: 'total_act_power' }))
  })

  it('saves the optional device filter', async () => {
    const { getByPlaceholderText } = render(ShellyLnm)
    const input = getByPlaceholderText('shellypro3em-8813bfe1ab68')
    await fireEvent.input(input, { target: { value: 'shellypro3em-aabbcc' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ shelly_lnm_device: 'shellypro3em-aabbcc' }))
  })
})
