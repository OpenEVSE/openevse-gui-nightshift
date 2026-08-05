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

  it('confirms before calling /update, then sends the asset URL', async () => {
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
    const { getByText, queryByText } = render(Firmware)
    await vi.waitFor(() => {
      expect(getByText('config.firmware.channel_release')).toBeInTheDocument()
    })

    // First click opens the confirm dialog without firing /update.
    await fireEvent.click(getByText('config.firmware.install_online'))
    expect(getByText('config.firmware.install_confirm_title')).toBeInTheDocument()
    expect(httpAPI).not.toHaveBeenCalledWith('POST', '/update', expect.anything())

    // Cancel takes the dialog away and still doesn't post.
    await fireEvent.click(getByText('config.firmware.install_confirm_no'))
    expect(queryByText('config.firmware.install_confirm_title')).toBeNull()
    expect(httpAPI).not.toHaveBeenCalledWith('POST', '/update', expect.anything())

    // Re-open and confirm — now we expect the POST.
    await fireEvent.click(getByText('config.firmware.install_online'))
    await fireEvent.click(getByText('config.firmware.install_confirm_yes'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith(
        'POST',
        '/update',
        JSON.stringify({ url: 'https://example/fw.bin' }),
      )
    })
  })

  it('lets the user retry after a failed OTA', async () => {
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
    const { getByText, queryByText } = render(Firmware)
    await vi.waitFor(() => {
      expect(getByText('config.firmware.channel_release')).toBeInTheDocument()
    })

    // Trigger the first install.
    await fireEvent.click(getByText('config.firmware.install_online'))
    await fireEvent.click(getByText('config.firmware.install_confirm_yes'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/update', JSON.stringify({ url: 'https://example/fw.bin' }))
    })

    // Device pushes a failure. Retry + Close buttons should appear.
    status_store.update((s) => ({ ...s, ota: 'failed' }))
    await vi.waitFor(() => {
      expect(getByText('config.firmware.ota_retry')).toBeInTheDocument()
      expect(getByText('config.firmware.ota_close')).toBeInTheDocument()
    })

    // Retry → another POST with the same asset URL.
    httpAPI.mockClear()
    await fireEvent.click(getByText('config.firmware.ota_retry'))
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/update', JSON.stringify({ url: 'https://example/fw.bin' }))
    })
  })

  it('Close button on a failed OTA hides the progress modal', async () => {
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
    const { getByText, queryByText } = render(Firmware)
    await vi.waitFor(() => {
      expect(getByText('config.firmware.channel_release')).toBeInTheDocument()
    })
    await fireEvent.click(getByText('config.firmware.install_online'))
    await fireEvent.click(getByText('config.firmware.install_confirm_yes'))
    status_store.update((s) => ({ ...s, ota: 'failed' }))
    await vi.waitFor(() => {
      expect(getByText('config.firmware.ota_close')).toBeInTheDocument()
    })
    await fireEvent.click(getByText('config.firmware.ota_close'))
    await vi.waitFor(() => {
      expect(queryByText('config.firmware.ota_failed')).toBeNull()
    })
  })

  it('shows the stable row with an Installed badge instead of Install when on it', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { tag_name: 'v1.0.0', name: 'v1.0.0', prerelease: false, assets: [
              { name: 'adafruit_featheresp32.bin', browser_download_url: 'u' },
            ] },
          ]),
      }),
    )
    config_store.set({ firmware: '7.1.3', version: 'v1.0.0', buildenv: 'adafruit_featheresp32' })
    const { getByText, queryByText } = render(Firmware)
    await vi.waitFor(() => {
      expect(getByText('config.firmware.channel_release')).toBeInTheDocument()
    })
    expect(getByText('config.firmware.installed_badge')).toBeInTheDocument()
    expect(queryByText('config.firmware.install_online')).toBeNull()
  })

  it('a self-built firmware version gets an Install button, not the Installed badge', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { tag_name: 'v1.0.0', name: 'v1.0.0', prerelease: false, assets: [
              { name: 'adafruit_featheresp32.bin', browser_download_url: 'u' },
            ] },
          ]),
      }),
    )
    // compareVersion() can't parse a branch/hash version and reports "equal" —
    // the page must not read that as "you're on the latest stable".
    config_store.set({
      firmware: '7.1.3',
      version: 'local_feature/gui-nightshift-default_2bcdf1d0_modified',
      buildenv: 'adafruit_featheresp32',
    })
    const { getByText, queryByText } = render(Firmware)
    await vi.waitFor(() => {
      expect(getByText('config.firmware.channel_release')).toBeInTheDocument()
    })
    expect(getByText('config.firmware.install_online')).toBeInTheDocument()
    expect(queryByText('config.firmware.installed_badge')).toBeNull()
    expect(queryByText('config.firmware.up_to_date')).toBeNull()
    expect(getByText('config.firmware.dev_build')).toBeInTheDocument()
  })

  it('sends X-Requested-With when uploading a local firmware file', async () => {
    // The upload is a raw fetch rather than httpAPI(), so it has to set the
    // header itself. Without it the firmware's CSRF guard answers 403
    // {"msg":"csrf"} for anyone authenticated by the session cookie, which
    // broke local firmware upload on every password-protected device.
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }))
    const { getByLabelText, getByText } = render(Firmware)

    const file = new File([new Uint8Array([1, 2, 3])], 'firmware.bin')
    const input = getByLabelText('config.firmware.choose_file')
    await fireEvent.change(input, { target: { files: [file] } })

    const install = getByText('config.firmware.install').closest('button')
    expect(install.disabled).toBe(false)
    await fireEvent.click(install)

    // The page also fetches the GitHub release list on mount, so pick out the
    // upload call rather than assuming it is the first one.
    await vi.waitFor(() => {
      expect(global.fetch.mock.calls.some(([u]) => u.endsWith('/update'))).toBe(true)
    })
    // In dev the mock server sits behind an /api prefix, and vitest runs with
    // import.meta.env.DEV set, so match on the suffix.
    const [url, init] = global.fetch.mock.calls.find(([u]) => u.endsWith('/update'))
    expect(url).toMatch(/\/update$/)
    expect(init.method).toBe('POST')
    expect(init.headers['X-Requested-With']).toBe('OpenEVSE')
    expect(init.body).toBeInstanceOf(FormData)
  })
})
