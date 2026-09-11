// src/routes/settings/__tests__/Http.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t, locales: { subscribe: (fn) => { fn(['en']); return () => {} } } }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { certificate_store } from '../../../lib/stores/certificates.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Http from '../Http.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  certificate_store.set([])
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
})

describe('HTTP page', () => {
  it('shows the credential fields when auth is already configured', () => {
    config_store.set({ www_username: 'admin', www_password: '••••••••••', lang: 'en' })
    const { getByText } = render(Http)
    expect(getByText('config.http.username')).toBeInTheDocument()
  })

  it('hides the credential fields when auth is off', () => {
    config_store.set({ www_username: '', www_password: '', lang: 'en' })
    const { queryByText } = render(Http)
    expect(queryByText('config.http.username')).not.toBeInTheDocument()
  })

  it('turning the auth toggle off clears both credentials', async () => {
    config_store.set({ www_username: 'admin', www_password: '••••••••••', lang: 'en' })
    const { getByRole } = render(Http)
    await fireEvent.click(getByRole('switch', { name: 'config.http.auth' }))
    expect(httpAPI).toHaveBeenCalledWith(
      'POST', '/config', JSON.stringify({ www_username: '', www_password: '' }),
    )
  })

  it('saves the HTTPS toggle', async () => {
    config_store.set({ www_username: '', www_password: '', lang: 'en', www_https_enabled: false })
    const { getByRole } = render(Http)
    await fireEvent.click(getByRole('switch', { name: 'config.http.https_enabled' }))
    expect(httpAPI).toHaveBeenCalledWith(
      'POST', '/config', JSON.stringify({ www_https_enabled: true }),
    )
  })

  it('warns when HTTPS is on with no certificate selected', () => {
    // The firmware falls back to plain HTTP in this state rather than failing
    // to boot, so nothing else would tell the user their TLS is not running.
    config_store.set({
      www_username: '', www_password: '', lang: 'en',
      www_https_enabled: true, www_certificate_id: '',
    })
    const { getByText } = render(Http)
    expect(getByText('config.http.https_no_cert')).toBeInTheDocument()
  })

  it('warns when the stored certificate id no longer resolves', () => {
    // The certificate was deleted but the id stayed in the config. The Select
    // falls back to showing "None" while the firmware still refuses to start
    // the listener, so an emptiness check would leave this state unwarned.
    certificate_store.set([{ id: 'bbb', type: 'client', name: 'Server cert' }])
    config_store.set({
      www_username: '', www_password: '', lang: 'en',
      www_https_enabled: true, www_certificate_id: 'gone',
    })
    const { getByText } = render(Http)
    expect(getByText('config.http.https_no_cert')).toBeInTheDocument()
  })

  it('falls back to None when the stored id matches no option', () => {
    // A native select given a value no option carries selects nothing at all,
    // which looks like a broken control instead of "no usable certificate".
    certificate_store.set([{ id: 'bbb', type: 'client', name: 'Server cert' }])
    config_store.set({
      www_username: '', www_password: '', lang: 'en',
      www_https_enabled: true, www_certificate_id: 'gone',
    })
    const { container } = render(Http)
    expect(container.querySelector('select').value).toBe('')
  })

  it('warns when the stored certificate has no private key', () => {
    // A root certificate is never offered in the Select, so selecting one is
    // only reachable from outside the UI — but the firmware treats it the same
    // way: getKey() returns NULL and it serves plain HTTP.
    certificate_store.set([{ id: 'aaa', type: 'root', name: 'Root CA' }])
    config_store.set({
      www_username: '', www_password: '', lang: 'en',
      www_https_enabled: true, www_certificate_id: 'aaa',
    })
    const { getByText } = render(Http)
    expect(getByText('config.http.https_no_cert')).toBeInTheDocument()
  })

  it('stays quiet once HTTPS has a usable certificate', () => {
    certificate_store.set([{ id: 'bbb', type: 'client', name: 'Server cert' }])
    config_store.set({
      www_username: '', www_password: '', lang: 'en',
      www_https_enabled: true, www_certificate_id: 'bbb',
    })
    const { queryByText } = render(Http)
    expect(queryByText('config.http.https_no_cert')).not.toBeInTheDocument()
  })

  it('shows HTTP as on and locked while TLS is not serving', () => {
    // should_start_http = config_http_enabled() || !use_ssl — port 80 stays
    // open whatever the flag says, so an "off" toggle here would be a lie.
    config_store.set({
      www_username: '', www_password: '', lang: 'en',
      www_https_enabled: false, www_http_enabled: false,
    })
    const { getByRole } = render(Http)
    const toggle = getByRole('switch', { name: 'config.http.http_enabled' })
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('releases the HTTP toggle once TLS is actually serving', () => {
    certificate_store.set([{ id: 'bbb', type: 'client', name: 'Server cert' }])
    config_store.set({
      www_username: '', www_password: '', lang: 'en',
      www_https_enabled: true, www_certificate_id: 'bbb', www_http_enabled: true,
    })
    const { getByRole } = render(Http)
    expect(getByRole('switch', { name: 'config.http.http_enabled' })).not.toBeDisabled()
  })

  it('says the listener settings need a restart, and prompts once one is saved', async () => {
    // web_server_setup() reads all of this once at boot and config_changed()
    // never re-opens a listener, so a save here changes nothing until reboot.
    config_store.set({ www_username: '', www_password: '', lang: 'en', www_https_enabled: false })
    const { getByRole, getByText, queryByText } = render(Http)
    expect(getByText('config.http.server_restart')).toBeInTheDocument()
    expect(queryByText(/server_restart_now/)).not.toBeInTheDocument()

    await fireEvent.click(getByRole('switch', { name: 'config.http.https_enabled' }))
    await vi.waitFor(() => {
      expect(getByText(/server_restart_now/)).toBeInTheDocument()
    })
    expect(getByText('config.firmware.restart_gateway').closest('a')).toHaveAttribute(
      'href', '#/settings/firmware',
    )
  })

  it('leaves the restart prompt alone when the save fails', async () => {
    httpAPI.mockResolvedValue('error')
    config_store.set({ www_username: '', www_password: '', lang: 'en', www_https_enabled: false })
    const { getByRole, queryByText } = render(Http)
    await fireEvent.click(getByRole('switch', { name: 'config.http.https_enabled' }))
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
    expect(queryByText(/server_restart_now/)).not.toBeInTheDocument()
  })

  it('offers only certificates that carry a private key', () => {
    certificate_store.set([
      { id: 'aaa', type: 'root', name: 'Root CA' },
      { id: 'bbb', type: 'client', name: 'Server cert' },
    ])
    config_store.set({
      www_username: '', www_password: '', lang: 'en',
      www_https_enabled: true, www_certificate_id: 'bbb',
    })
    const { getByText, queryByText } = render(Http)
    expect(getByText('Server cert')).toBeInTheDocument()
    expect(queryByText('Root CA')).not.toBeInTheDocument()
  })

  it('surfaces the write-error alert on a failed save', async () => {
    httpAPI.mockResolvedValue('error')
    config_store.set({ www_username: 'admin', www_password: '••••••••••', lang: 'en' })
    const { getByRole } = render(Http)
    await fireEvent.click(getByRole('switch', { name: 'config.http.auth' }))
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })
})
