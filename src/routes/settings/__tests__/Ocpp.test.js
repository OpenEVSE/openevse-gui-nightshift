// src/routes/settings/__tests__/Ocpp.test.js
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
import Ocpp from '../Ocpp.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ ocpp_connected: false })
})

describe('OCPP page', () => {
  it('shows the settings expanded by default (no enable switch)', () => {
    config_store.set({ ocpp_enabled: false, ocpp_auth_auto: false })
    const { getByText, queryByText } = render(Ocpp)
    expect(getByText('config.ocpp.server')).toBeInTheDocument()
    expect(queryByText('config.ocpp.enable')).not.toBeInTheDocument()
  })

  it('links to the Charge Manager to enable/schedule OCPP', () => {
    config_store.set({ ocpp_enabled: false, ocpp_auth_auto: false })
    const { getByText } = render(Ocpp)
    const link = getByText('config.add_in_charge_manager', { exact: false }).closest('a')
    expect(link).toHaveAttribute('href', '#/schedule')
  })

  it('shows the idtag field only when auto-auth is on', async () => {
    config_store.set({ ocpp_enabled: true, ocpp_auth_auto: false })
    const { queryByText } = render(Ocpp)
    expect(queryByText('config.ocpp.idtag')).not.toBeInTheDocument()
    config_store.set({ ocpp_enabled: true, ocpp_auth_auto: true })
    await vi.waitFor(() => {
      expect(queryByText('config.ocpp.idtag')).toBeInTheDocument()
    })
  })

  it('saves the server field on blur', async () => {
    config_store.set({ ocpp_enabled: true, ocpp_server: 'old', ocpp_auth_auto: false })
    const { getByDisplayValue } = render(Ocpp)
    const input = getByDisplayValue('old')
    await fireEvent.input(input, { target: { value: 'wss://x' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ ocpp_server: 'wss://x' }))
  })

  it('surfaces the write-error alert on a failed save', async () => {
    httpAPI.mockResolvedValue('error')
    config_store.set({ ocpp_enabled: true, ocpp_server: 'old', ocpp_auth_auto: false })
    const { getByDisplayValue } = render(Ocpp)
    const input = getByDisplayValue('old')
    await fireEvent.input(input, { target: { value: 'wss://x' } })
    await fireEvent.blur(input)
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })
})
