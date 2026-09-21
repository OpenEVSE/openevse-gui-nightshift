// src/routes/settings/__tests__/Rfid.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({
  httpAPI: vi.fn(() =>
    Promise.resolve({ status: 200, body: JSON.stringify({ msg: 'Waiting for badge' }) }),
  ),
}))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { status_store } from '../../../lib/stores/status.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import { uisettings_store } from '../../../lib/stores/uisettings.js'
import { rfid_users_store } from '../../../lib/stores/rfid_users.js'
import Rfid from '../Rfid.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ status: 200, body: JSON.stringify({ msg: 'Waiting for badge' }) })
  status_store.set({ rfid_input: '' })
  uisettings_store.update((s) => ({ ...s, dev_features: false }))
  rfid_users_store.reset()
})

describe('RFID page', () => {
  it('hides Scan and shows a hint when RFID is not enabled', () => {
    config_store.set({ rfid_enabled: false, rfid_storage: '' })
    const { getByText, queryByText } = render(Rfid)
    expect(getByText('config.rfid.not_enabled')).toBeInTheDocument()
    expect(queryByText('config.rfid.scan')).not.toBeInTheDocument()
  })

  it('links to the Charge Manager to enable/schedule RFID', () => {
    config_store.set({ rfid_enabled: false, rfid_storage: '' })
    const { getByText } = render(Rfid)
    const link = getByText('config.add_in_charge_manager', { exact: false }).closest('a')
    expect(link).toHaveAttribute('href', '#/schedule')
  })

  it('shows the reader-found badge when a reader is present', () => {
    status_store.set({ rfid_input: '', rfid_reader: 1 })
    config_store.set({ rfid_enabled: false, rfid_storage: '' })
    const { getByText, queryByText } = render(Rfid)
    expect(getByText('config.rfid.reader_found')).toBeInTheDocument()
    expect(queryByText('config.rfid.no_reader')).not.toBeInTheDocument()
  })

  it('shows the no-reader badge when no reader is present', () => {
    status_store.set({ rfid_input: '', rfid_reader: 0 })
    config_store.set({ rfid_enabled: false, rfid_storage: '' })
    const { getByText, queryByText } = render(Rfid)
    expect(getByText('config.rfid.no_reader')).toBeInTheDocument()
    expect(queryByText('config.rfid.reader_found')).not.toBeInTheDocument()
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
    expect(httpAPI).toHaveBeenCalledWith('GET', '/rfid/add', null, 'txt', 60000, { raw: true })
  })

  it('registers a freshly scanned tag', async () => {
    config_store.set({ rfid_enabled: true, rfid_storage: 'AA11' })
    status_store.set({ rfid_input: 'CC33' })
    const { getByText } = render(Rfid)
    await fireEvent.click(getByText('config.rfid.register'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ rfid_storage: 'AA11,CC33' }))
  })

  it('does not show the name-edit affordance when Labs is off', () => {
    config_store.set({ rfid_enabled: true, rfid_storage: 'AA11' })
    const { queryByText } = render(Rfid)
    expect(queryByText('config.rfid.add_user_name')).not.toBeInTheDocument()
  })

  it('exposes the add-name affordance when Labs is on and the tag has no name', () => {
    uisettings_store.update((s) => ({ ...s, dev_features: true }))
    config_store.set({ rfid_enabled: true, rfid_storage: 'AA11' })
    const { getByText } = render(Rfid)
    expect(getByText('config.rfid.add_user_name')).toBeInTheDocument()
  })

  it('shows the assigned name when Labs is on and the user-name map is loaded', () => {
    uisettings_store.update((s) => ({ ...s, dev_features: true }))
    rfid_users_store.set({ users: { AA11: 'Alice' }, loading: false, error: false })
    config_store.set({ rfid_enabled: true, rfid_storage: 'AA11' })
    const { getByText, queryByText } = render(Rfid)
    expect(getByText('Alice')).toBeInTheDocument()
    expect(queryByText('config.rfid.add_user_name')).not.toBeInTheDocument()
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

  it('shows a specific alert when the firmware rejects the scan because RFID is disabled', async () => {
    httpAPI.mockResolvedValue({
      status: 400,
      body: JSON.stringify({ msg: 'RFID is not enabled, add it in Charge Manager first' }),
    })
    config_store.set({ rfid_enabled: true, rfid_storage: '' })
    const { getByText } = render(Rfid)
    await fireEvent.click(getByText('config.rfid.scan'))
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
      expect(get(uistates_store).alertbox.title).toBe('alert.rfid_scan_failed_title')
      expect(get(uistates_store).alertbox.body).toBe('config.rfid.not_enabled')
    })
  })

  it('detects a rejected scan by HTTP status, not by the response wording', async () => {
    // Same shape as a real rejection, but with different wording than the
    // firmware currently sends -- this only alerts because status !== 200.
    httpAPI.mockResolvedValue({
      status: 400,
      body: JSON.stringify({ msg: 'nope, not today' }),
    })
    config_store.set({ rfid_enabled: true, rfid_storage: '' })
    const { getByText } = render(Rfid)
    await fireEvent.click(getByText('config.rfid.scan'))
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
      expect(get(uistates_store).alertbox.body).toBe('alert.write_failed_body')
    })
  })
})
