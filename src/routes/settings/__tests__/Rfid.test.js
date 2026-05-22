// src/routes/settings/__tests__/Rfid.test.js
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
import { status_store } from '../../../lib/stores/status.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Rfid from '../Rfid.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ rfid_input: '' })
})

describe('RFID page', () => {
  it('hides the tag manager until rfid is enabled', () => {
    config_store.set({ rfid_enabled: false, rfid_storage: '' })
    const { queryByText } = render(Rfid)
    expect(queryByText('config.rfid.scan')).not.toBeInTheDocument()
  })

  it('shows the scan button when rfid is enabled', () => {
    config_store.set({ rfid_enabled: true, rfid_storage: '' })
    const { getByText } = render(Rfid)
    expect(getByText('config.rfid.scan')).toBeInTheDocument()
  })

  it('lists registered tags', () => {
    config_store.set({ rfid_enabled: true, rfid_storage: 'AA11,BB22' })
    const { getByText } = render(Rfid)
    expect(getByText('AA11')).toBeInTheDocument()
    expect(getByText('BB22')).toBeInTheDocument()
  })

  it('calls the scan endpoint when Scan is clicked', async () => {
    config_store.set({ rfid_enabled: true, rfid_storage: '' })
    const { getByText } = render(Rfid)
    await fireEvent.click(getByText('config.rfid.scan'))
    expect(httpAPI).toHaveBeenCalledWith('GET', '/rfid/add', null, 'txt', 60000)
  })

  it('registers a freshly scanned tag', async () => {
    config_store.set({ rfid_enabled: true, rfid_storage: 'AA11' })
    status_store.set({ rfid_input: 'CC33' })
    const { getByText } = render(Rfid)
    await fireEvent.click(getByText('config.rfid.register'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ rfid_storage: 'AA11,CC33' }))
  })

  it('shows the alert box when the scan call fails', async () => {
    httpAPI.mockResolvedValue('error')
    config_store.set({ rfid_enabled: true, rfid_storage: '' })
    const { getByText } = render(Rfid)
    await fireEvent.click(getByText('config.rfid.scan'))
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })
})
