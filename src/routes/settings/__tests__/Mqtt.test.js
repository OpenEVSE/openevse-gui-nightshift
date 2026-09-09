// src/routes/settings/__tests__/Mqtt.test.js
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
import { certificate_store } from '../../../lib/stores/certificates.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Mqtt from '../Mqtt.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ mqtt_connected: false })
  certificate_store.set([])
})

describe('MQTT page', () => {
  it('hides the form until mqtt is enabled', () => {
    config_store.set({ mqtt_enabled: false, mqtt_supported_protocols: ['mqtt'] })
    const { queryByText } = render(Mqtt)
    expect(queryByText('config.mqtt.server')).not.toBeInTheDocument()
  })

  it('shows the form when mqtt is enabled', () => {
    config_store.set({ mqtt_enabled: true, mqtt_protocol: 'mqtt', mqtt_supported_protocols: ['mqtt', 'mqtts'] })
    const { getByText } = render(Mqtt)
    expect(getByText('config.mqtt.server')).toBeInTheDocument()
  })

  it('shows the TLS block only for the mqtts protocol', async () => {
    config_store.set({ mqtt_enabled: true, mqtt_protocol: 'mqtt', mqtt_supported_protocols: ['mqtt', 'mqtts'] })
    const { queryByText, rerender } = render(Mqtt)
    expect(queryByText('config.mqtt.reject_unauthorized')).not.toBeInTheDocument()
    config_store.set({ mqtt_enabled: true, mqtt_protocol: 'mqtts', mqtt_supported_protocols: ['mqtt', 'mqtts'] })
    await vi.waitFor(() => {
      expect(queryByText('config.mqtt.reject_unauthorized')).toBeInTheDocument()
    })
  })

  it('saves the server field on blur', async () => {
    config_store.set({ mqtt_enabled: true, mqtt_protocol: 'mqtt', mqtt_server: 'old', mqtt_supported_protocols: ['mqtt'] })
    const { getByDisplayValue } = render(Mqtt)
    const input = getByDisplayValue('old')
    await fireEvent.input(input, { target: { value: 'broker.local' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ mqtt_server: 'broker.local' }))
  })

  it('surfaces the write-error alert on a failed save', async () => {
    httpAPI.mockResolvedValue('error')
    config_store.set({ mqtt_enabled: true, mqtt_protocol: 'mqtt', mqtt_server: 'old', mqtt_supported_protocols: ['mqtt'] })
    const { getByDisplayValue } = render(Mqtt)
    const input = getByDisplayValue('old')
    await fireEvent.input(input, { target: { value: 'broker.local' } })
    await fireEvent.blur(input)
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })
  it('saves the client id, which names the local connection only', async () => {
    config_store.set({
      mqtt_enabled: true,
      mqtt_protocol: 'mqtt',
      mqtt_client_id: 'openevse-9cc0',
      mqtt_supported_protocols: ['mqtt'],
    })
    const { getByDisplayValue } = render(Mqtt)
    const input = getByDisplayValue('openevse-9cc0')
    await fireEvent.input(input, { target: { value: 'garage' } })
    await fireEvent.blur(input)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ mqtt_client_id: 'garage' }))
  })

  it('saves the $SYS broker query toggle', async () => {
    config_store.set({ mqtt_enabled: true, mqtt_protocol: 'mqtt', mqtt_sys_query: true, mqtt_supported_protocols: ['mqtt'] })
    const { getByLabelText } = render(Mqtt)
    await fireEvent.click(getByLabelText('config.mqtt.sys_query'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ mqtt_sys_query: false }))
  })
})

describe('MQTT page — local publisher held down', () => {
  const ENABLED = { mqtt_enabled: true, mqtt_protocol: 'mqtt', mqtt_supported_protocols: ['mqtt'] }

  it('explains a one-connection board instead of showing a connection status', () => {
    config_store.set({ ...ENABLED, cloud_enabled: true })
    status_store.set({ mqtt_connected: false, local_mqtt_disabled_reason: 'one_connection' })
    const { getByText, queryByText } = render(Mqtt)
    expect(getByText('config.mqtt.held_one_connection')).toBeInTheDocument()
    expect(queryByText('config.mqtt.status_label')).not.toBeInTheDocument()
    // No wait loop, and nothing to reset.
    expect(queryByText('config.mqtt.status_connecting')).not.toBeInTheDocument()
    expect(queryByText('config.mqtt.reset')).not.toBeInTheDocument()
  })

  it('explains the low-heap stop with its own wording', () => {
    config_store.set({ ...ENABLED, cloud_enabled: true })
    status_store.set({ mqtt_connected: false, local_mqtt_disabled_reason: 'low_heap' })
    const { getByText, queryByText } = render(Mqtt)
    expect(getByText('config.mqtt.held_low_heap')).toBeInTheDocument()
    expect(queryByText('config.mqtt.held_one_connection')).not.toBeInTheDocument()
  })

  it('does not poll GET /mqtt for a connection that will not come up', async () => {
    config_store.set({ ...ENABLED, cloud_enabled: true })
    status_store.set({ mqtt_connected: false, local_mqtt_disabled_reason: 'one_connection' })
    render(Mqtt)
    await Promise.resolve()
    expect(httpAPI).not.toHaveBeenCalledWith('GET', '/mqtt')
  })

  it('keeps the enable toggle and the broker settings usable', async () => {
    config_store.set({ ...ENABLED, mqtt_server: 'old', cloud_enabled: true })
    status_store.set({ mqtt_connected: false, local_mqtt_disabled_reason: 'one_connection' })
    const { getByLabelText, getByDisplayValue } = render(Mqtt)
    expect(getByDisplayValue('old')).toBeInTheDocument()
    await fireEvent.click(getByLabelText('config.mqtt.enable'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ mqtt_enabled: false }))
  })

  it('offers the cloud page only on a build that has the cloud client', () => {
    status_store.set({ mqtt_connected: false, local_mqtt_disabled_reason: 'one_connection' })

    config_store.set({ ...ENABLED, cloud_enabled: true })
    const withClient = render(Mqtt)
    expect(withClient.queryByText('config.mqtt.held_cloud_link')).toBeInTheDocument()
    withClient.unmount()

    config_store.set({ ...ENABLED })
    const withoutClient = render(Mqtt)
    expect(withoutClient.queryByText('config.mqtt.held_cloud_link')).not.toBeInTheDocument()
  })

  it('behaves exactly as before for the reasons that are not a hold-down', () => {
    config_store.set(ENABLED)
    for (const reason of ['', 'not_configured']) {
      status_store.set({ mqtt_connected: false, local_mqtt_disabled_reason: reason })
      const { getByText, queryByText, unmount } = render(Mqtt)
      expect(getByText('config.mqtt.status_label')).toBeInTheDocument()
      expect(queryByText('config.mqtt.held_one_connection')).not.toBeInTheDocument()
      unmount()
    }
  })
})
