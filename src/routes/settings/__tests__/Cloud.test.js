// src/routes/settings/__tests__/Cloud.test.js
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
import { certificate_store } from '../../../lib/stores/certificates.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Cloud from '../Cloud.svelte'

const CLAIMED = {
  cloud_enabled: true,
  cloud_server: 'broker.example.net',
  cloud_port: 8883,
  cloud_thing: '',
  cloud_certificate_id: '9c0d1e2f',
  cloud_agent_interval: 60,
}

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ cloud_connected: 0, cloud_thing: '' })
  certificate_store.set([
    { id: '1a2b3c4d', type: 'root', name: 'Broker root CA' },
    { id: '9c0d1e2f', type: 'client', name: 'Charger identity' },
  ])
})

describe('Cloud page', () => {
  it('shows the live connection status', async () => {
    config_store.set(CLAIMED)
    status_store.set({ cloud_connected: 1, cloud_thing: 'evse-a4cf12ab9cc0' })
    const { getByText } = render(Cloud)
    expect(getByText('config.cloud.status_connected')).toBeInTheDocument()
    expect(getByText('evse-a4cf12ab9cc0')).toBeInTheDocument()
  })

  it('says why the client is held back rather than showing a dead connection', async () => {
    config_store.set({ ...CLAIMED, cloud_agent_interval: 0 })
    const { getByText } = render(Cloud)
    expect(getByText('config.cloud.status_interval_zero')).toBeInTheDocument()
  })

  it('renders an unclaimed charger as not-yet-claimed, not as an error', () => {
    config_store.set({ ...CLAIMED, cloud_server: '' })
    const { getByText } = render(Cloud)
    expect(getByText('config.cloud.status_unclaimed')).toBeInTheDocument()
    expect(getByText('config.cloud.identity_unclaimed')).toBeInTheDocument()
  })

  it('saves the enable toggle', async () => {
    config_store.set({ ...CLAIMED, cloud_enabled: false })
    const { getByLabelText } = render(Cloud)
    await fireEvent.click(getByLabelText('config.cloud.enable'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ cloud_enabled: true }))
  })

  it('saves the status interval', async () => {
    config_store.set(CLAIMED)
    const { getByDisplayValue } = render(Cloud)
    const input = getByDisplayValue('60')
    await fireEvent.input(input, { target: { value: '300' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith(
      'POST',
      '/config',
      JSON.stringify({ cloud_agent_interval: 300 }),
    )
  })

  it('keeps the provisioning fields read-only until editing is asked for', async () => {
    config_store.set(CLAIMED)
    const { queryByDisplayValue, getByText } = render(Cloud)
    expect(queryByDisplayValue('broker.example.net')).not.toBeInTheDocument()
    // The certificate is named, not offered as a dropdown.
    expect(getByText('Charger identity')).toBeInTheDocument()

    await fireEvent.click(getByText('config.cloud.edit'))
    expect(queryByDisplayValue('broker.example.net')).toBeInTheDocument()
  })

  it('refuses a malformed identity without writing it to the device', async () => {
    config_store.set(CLAIMED)
    const { getByText, getByPlaceholderText } = render(Cloud)
    await fireEvent.click(getByText('config.cloud.edit'))

    const input = getByPlaceholderText('evse-aabbccddeeff')
    await fireEvent.input(input, { target: { value: 'evse-nope' } })
    await fireEvent.blur(input)

    expect(httpAPI).not.toHaveBeenCalledWith('POST', '/config', expect.anything())
    expect(getByText('config.validation.cloud_thing')).toBeInTheDocument()
  })

  it('saves a well-formed identity', async () => {
    config_store.set(CLAIMED)
    const { getByText, getByPlaceholderText } = render(Cloud)
    await fireEvent.click(getByText('config.cloud.edit'))

    const input = getByPlaceholderText('evse-aabbccddeeff')
    await fireEvent.input(input, { target: { value: 'evse-a4cf12ab9cc0' } })
    await fireEvent.blur(input)

    expect(httpAPI).toHaveBeenCalledWith(
      'POST',
      '/config',
      JSON.stringify({ cloud_thing: 'evse-a4cf12ab9cc0' }),
    )
  })

  it('polls GET /status for the cloud fields, which the WebSocket never pushes', async () => {
    config_store.set(CLAIMED)
    render(Cloud)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('GET', '/status')
    })
  })

  it('trusts a fresh /status over the store for the dropped counter', async () => {
    // cloud_dropped is omitted when zero and the store merge is a shallow
    // spread, so a stale non-zero value must not survive a clean poll.
    config_store.set(CLAIMED)
    status_store.set({ cloud_connected: 1, cloud_thing: 'evse-a4cf12ab9cc0', cloud_dropped: 4 })
    httpAPI.mockResolvedValue({ cloud_connected: 1, cloud_thing: 'evse-a4cf12ab9cc0' })

    const { queryByText } = render(Cloud)
    expect(queryByText('config.cloud.dropped')).toBeInTheDocument()
    await vi.waitFor(() => {
      expect(queryByText('config.cloud.dropped')).not.toBeInTheDocument()
    })
  })
})
