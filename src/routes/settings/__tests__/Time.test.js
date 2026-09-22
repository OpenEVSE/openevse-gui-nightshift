// src/routes/settings/__tests__/Time.test.js
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
import Time from '../Time.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
  status_store.set({ time: '2026-05-22T10:00:00Z' })
})

describe('Time page', () => {
  it('shows the NTP host field in NTP mode', () => {
    config_store.set({ sntp_enabled: true, sntp_hostname: 'pool.ntp.org', time_zone: 'UTC|UTC0' })
    const { getByText } = render(Time)
    expect(getByText('config.time.ntp_host')).toBeInTheDocument()
  })

  it('hides the NTP host field in manual mode', () => {
    config_store.set({ sntp_enabled: false, time_zone: 'UTC|UTC0' })
    const { queryByText } = render(Time)
    expect(queryByText('config.time.ntp_host')).not.toBeInTheDocument()
  })

  it('shows the set-clock button in manual mode', () => {
    config_store.set({ sntp_enabled: false, time_zone: 'UTC|UTC0' })
    const { getByText } = render(Time)
    expect(getByText('config.time.set_now')).toBeInTheDocument()
  })

  it('posts to /time when the set-clock button is clicked', async () => {
    config_store.set({ sntp_enabled: false, time_zone: 'UTC|UTC0' })
    const { getByText } = render(Time)
    await fireEvent.click(getByText('config.time.set_now'))
    expect(httpAPI).toHaveBeenCalled()
    expect(httpAPI.mock.calls[0][1]).toBe('/time')
  })

  it('shows the alert box when the set-clock call fails', async () => {
    httpAPI.mockResolvedValue('error')
    config_store.set({ sntp_enabled: false, time_zone: 'UTC|UTC0' })
    const { getByText } = render(Time)
    await fireEvent.click(getByText('config.time.set_now'))
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })

  describe('NTP server from DHCP', () => {
    const timeStatus = {
      ntp_status: 'synchronized',
      ntp_last_sync: 1_700_000_000,
      ntp_next_sync_ms: 1000,
      ntp_server_ip: '192.168.1.1',
      ntp_server: '192.168.1.1',
      ntp_server_source: 'dhcp',
      ntp_dhcp_server: '192.168.1.1',
    }

    it('hides the DHCP toggle when the firmware has no sntp_dhcp key', () => {
      config_store.set({ sntp_enabled: true, sntp_hostname: 'pool.ntp.org', time_zone: 'UTC|UTC0' })
      const { queryByLabelText } = render(Time)
      expect(queryByLabelText('config.time.ntp_dhcp')).toBeNull()
    })

    it('shows the toggle checked and writes sntp_dhcp when flipped', async () => {
      config_store.set({ sntp_enabled: true, sntp_dhcp: true, sntp_hostname: 'pool.ntp.org', time_zone: 'UTC|UTC0' })
      const { getByLabelText } = render(Time)
      const toggle = getByLabelText('config.time.ntp_dhcp')
      expect(toggle).toHaveAttribute('aria-checked', 'true')
      await fireEvent.click(toggle)
      expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ sntp_dhcp: false }))
    })

    it('reports the DHCP-offered server and that it is the one in use', async () => {
      httpAPI.mockImplementation((method, url) =>
        Promise.resolve(url === '/time' ? timeStatus : { msg: 'done' }))
      config_store.set({ sntp_enabled: true, sntp_dhcp: true, sntp_hostname: 'pool.ntp.org', time_zone: 'UTC|UTC0' })
      const { findByText, getByText, queryByText } = render(Time)
      // the DHCP server gets top billing; the hostname box becomes the fallback
      expect(await findByText('config.time.ntp_host_from_dhcp')).toBeInTheDocument()
      expect(getByText('config.time.ntp_host_fallback')).toBeInTheDocument()
      expect(queryByText('config.time.ntp_host')).toBeNull()
      expect(getByText('config.time.ntp_server_in_use')).toBeInTheDocument()
      expect(getByText('192.168.1.1 (config.time.ntp_source_dhcp)')).toBeInTheDocument()
      // the DNS badge is about the hostname field, not the DHCP server
      expect(queryByText(/config\.time\.ntp_dns_ok/)).toBeNull()
    })

    it('says when DHCP offered nothing and the configured host is in use', async () => {
      httpAPI.mockImplementation((method, url) =>
        Promise.resolve(url === '/time'
          ? { ...timeStatus, ntp_server: 'pool.ntp.org', ntp_server_source: 'config', ntp_dhcp_server: undefined }
          : { msg: 'done' }))
      config_store.set({ sntp_enabled: true, sntp_dhcp: true, sntp_hostname: 'pool.ntp.org', time_zone: 'UTC|UTC0' })
      const { findByText, getByText, queryByText } = render(Time)
      expect(await findByText('config.time.ntp_dhcp_none')).toBeInTheDocument()
      expect(getByText('config.time.ntp_host')).toBeInTheDocument()
      expect(queryByText('config.time.ntp_host_from_dhcp')).toBeNull()
      expect(getByText('pool.ntp.org (config.time.ntp_source_config)')).toBeInTheDocument()
    })
  })
})
