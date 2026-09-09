// src/routes/settings/__tests__/Certificates.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { certificate_store } from '../../../lib/stores/certificates.js'
import { config_store } from '../../../lib/stores/config.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Certificates from '../Certificates.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  certificate_store.set([])
  config_store.set({})
  uistates_store.resetAlertBox()
})

describe('Certificates page', () => {
  it('shows the empty state when there are no certificates', () => {
    const { getByText } = render(Certificates)
    expect(getByText('config.certificates.empty')).toBeInTheDocument()
  })

  it('lists certificates from the store', () => {
    certificate_store.set([{ id: '1', type: 'root', name: 'Root CA' }])
    const { getByText } = render(Certificates)
    expect(getByText('Root CA')).toBeInTheDocument()
  })

  it('opens the add-modal', async () => {
    const { getByText, getByRole } = render(Certificates)
    expect(() => getByRole('dialog')).toThrow()
    await fireEvent.click(getByText('config.certificates.add'))
    expect(getByRole('dialog')).toBeInTheDocument()
  })

  it('deletes a certificate via the store', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    certificate_store.set([{ id: '7', type: 'client', name: 'Client A' }])
    const { getByLabelText } = render(Certificates)
    await fireEvent.click(getByLabelText('config.certificates.delete'))
    expect(httpAPI).toHaveBeenCalledWith('DELETE', '/certificates/7')
  })

  it('marks which connection is using a certificate', () => {
    certificate_store.set([
      { id: '1a2b3c4d', type: 'root', name: 'Broker root CA' },
      { id: '5e6f7a8b', type: 'client', name: 'Home broker' },
      { id: '9c0d1e2f', type: 'client', name: 'Charger identity' },
    ])
    config_store.set({ mqtt_certificate_id: '5e6f7a8b', cloud_certificate_id: '9c0d1e2f' })
    const { getByText, queryAllByText } = render(Certificates)
    expect(getByText('config.certificates.in_use_mqtt')).toBeInTheDocument()
    expect(getByText('config.certificates.in_use_cloud')).toBeInTheDocument()
    // The unreferenced root CA gets no badge.
    expect(queryAllByText(/config\.certificates\.in_use_/)).toHaveLength(2)
  })

  it('shows an alert when certificate delete returns an error', async () => {
    httpAPI.mockResolvedValue('error')
    certificate_store.set([{ id: '9', type: 'root', name: 'Bad CA' }])
    const { getByLabelText } = render(Certificates)
    await fireEvent.click(getByLabelText('config.certificates.delete'))
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })
})
