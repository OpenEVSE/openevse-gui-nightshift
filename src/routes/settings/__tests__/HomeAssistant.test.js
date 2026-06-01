// src/routes/settings/__tests__/HomeAssistant.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))
vi.mock('../../../lib/config/homeassistant.js', () => ({
  isHaConnected: (s) => !!(s && s.connected),
  startHaAuth: vi.fn(),
  fetchHaStatus: vi.fn().mockResolvedValue({ enabled: true, connected: false, ha_url: '' }),
  disconnectHa: vi.fn().mockResolvedValue(true),
}))

import { config_store } from '../../../lib/stores/config.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import HomeAssistant from '../HomeAssistant.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  config_store.set({ ha_url: '' })
})

describe('HomeAssistant settings page', () => {
  it('renders a URL field label', () => {
    const { getByText } = render(HomeAssistant)
    // $_ returns the i18n key in tests; the label text is the key itself
    expect(getByText('config.homeassistant.url')).toBeInTheDocument()
  })

  it('renders a Connect button when not connected', () => {
    const { getByText } = render(HomeAssistant)
    expect(getByText('config.homeassistant.connect')).toBeInTheDocument()
  })

  it('renders a disconnected status when not connected', () => {
    const { getByText } = render(HomeAssistant)
    expect(getByText('config.homeassistant.disconnected')).toBeInTheDocument()
  })

  it('Connect button is disabled when URL is empty', () => {
    config_store.set({ ha_url: '' })
    const { getByText } = render(HomeAssistant)
    const btn = getByText('config.homeassistant.connect').closest('button')
    expect(btn).toBeDisabled()
  })

  it('Connect button is enabled when URL is set', () => {
    config_store.set({ ha_url: 'http://homeassistant.local:8123' })
    const { getByText } = render(HomeAssistant)
    const btn = getByText('config.homeassistant.connect').closest('button')
    expect(btn).not.toBeDisabled()
  })
})
