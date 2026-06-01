// src/routes/__tests__/Settings.test.js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import Settings from '../Settings.svelte'
import { SETTINGS_PAGES } from '../../lib/config/pages.js'
import { config_store } from '../../lib/stores/config.js'

describe('Settings hub', () => {
  it('renders the four section headings', () => {
    const { getByText } = render(Settings)
    for (const s of ['connectivity', 'charger', 'energy', 'system']) {
      expect(getByText('config.sections.' + s)).toBeInTheDocument()
    }
  })
  it('renders a link for every config page when ha is supported', () => {
    config_store.set({ ha_url: 'http://homeassistant.local' })
    const { getAllByRole } = render(Settings)
    const links = getAllByRole('link')
    expect(links).toHaveLength(SETTINGS_PAGES.length)
    for (const p of SETTINGS_PAGES) {
      expect(links.some((l) => l.getAttribute('href') === '#' + p.route)).toBe(true)
    }
  })
  it('hides the home-assistant link when ha is unsupported', () => {
    config_store.set({})
    const { getAllByRole } = render(Settings)
    const links = getAllByRole('link')
    expect(links).toHaveLength(SETTINGS_PAGES.length - 1)
    expect(links.some((l) => l.getAttribute('href') === '#/settings/home-assistant')).toBe(false)
  })
})
