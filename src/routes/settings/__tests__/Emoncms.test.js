// src/routes/settings/__tests__/Emoncms.test.js
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
import Emoncms from '../Emoncms.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ emoncms_connected: 0, packets_success: 0, packets_sent: 0 })
})

describe('EmonCMS page', () => {
  it('hides the form until emoncms is enabled', () => {
    config_store.set({ emoncms_enabled: false })
    const { queryByText } = render(Emoncms)
    expect(queryByText('config.emoncms.server')).not.toBeInTheDocument()
  })

  it('shows the form when emoncms is enabled', () => {
    config_store.set({ emoncms_enabled: true })
    const { getByText } = render(Emoncms)
    expect(getByText('config.emoncms.server')).toBeInTheDocument()
  })

  it('saves the server field on blur', async () => {
    config_store.set({ emoncms_enabled: true, emoncms_server: 'old' })
    const { getByDisplayValue } = render(Emoncms)
    const input = getByDisplayValue('old')
    await fireEvent.input(input, { target: { value: 'emoncms.org' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ emoncms_server: 'emoncms.org' }))
  })

  it('surfaces the write-error alert on a failed save', async () => {
    httpAPI.mockResolvedValue('error')
    config_store.set({ emoncms_enabled: true, emoncms_server: 'old' })
    const { getByDisplayValue } = render(Emoncms)
    const input = getByDisplayValue('old')
    await fireEvent.input(input, { target: { value: 'x' } })
    await fireEvent.blur(input)
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })
})
