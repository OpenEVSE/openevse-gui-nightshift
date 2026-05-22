// src/routes/settings/__tests__/Time.test.js
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
import Time from '../Time.svelte'

beforeEach(() => {
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
})
