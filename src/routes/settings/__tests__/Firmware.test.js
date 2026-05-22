// src/routes/settings/__tests__/Firmware.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'restart gateway' })) }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { status_store } from '../../../lib/stores/status.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Firmware from '../Firmware.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'restart gateway' })
  config_store.set({ firmware: '7.1.3', version: '5.1.2' })
  status_store.set({})
  uistates_store.resetAlertBox()
})

describe('Firmware page', () => {
  it('shows the device versions', () => {
    const { getByText } = render(Firmware)
    expect(getByText('7.1.3')).toBeInTheDocument()
    expect(getByText('5.1.2')).toBeInTheDocument()
  })

  it('restarts the gateway', async () => {
    const { getByText } = render(Firmware)
    await fireEvent.click(getByText('config.firmware.restart_gateway'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/restart', JSON.stringify({ device: 'gateway' }))
  })

  it('asks for confirmation before a factory reset', async () => {
    const { getByText, queryByText } = render(Firmware)
    expect(queryByText('config.firmware.reset_confirm')).not.toBeInTheDocument()
    await fireEvent.click(getByText('config.firmware.reset'))
    expect(getByText('config.firmware.reset_confirm')).toBeInTheDocument()
  })

  it('shows an alert when restart-gateway returns an error', async () => {
    httpAPI.mockResolvedValue('error')
    const { getByText } = render(Firmware)
    await fireEvent.click(getByText('config.firmware.restart_gateway'))
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })

  it('shows the loading state then the channels from GitHub', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { tag_name: 'v9.9.9', name: 'v9.9.9', prerelease: false, assets: [
              { name: 'adafruit_featheresp32.bin', browser_download_url: 'u' },
            ] },
          ]),
      }),
    )
    config_store.set({ firmware: '7.1.3', version: 'v1.0.0', buildenv: 'adafruit_featheresp32' })
    const { getByText } = render(Firmware)
    await vi.waitFor(() => {
      expect(getByText('config.firmware.channel_release')).toBeInTheDocument()
    })
  })

  it('calls /update with the asset URL when install online is clicked', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { tag_name: 'v9.9.9', name: 'v9.9.9', prerelease: false, assets: [
              { name: 'adafruit_featheresp32.bin', browser_download_url: 'https://example/fw.bin' },
            ] },
          ]),
      }),
    )
    config_store.set({ firmware: '7.1.3', version: 'v1.0.0', buildenv: 'adafruit_featheresp32' })
    const { getByText } = render(Firmware)
    await vi.waitFor(() => {
      expect(getByText('config.firmware.channel_release')).toBeInTheDocument()
    })
    await fireEvent.click(getByText('config.firmware.install_online'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith(
        'POST',
        '/update',
        JSON.stringify({ url: 'https://example/fw.bin' }),
      )
    })
  })
})
