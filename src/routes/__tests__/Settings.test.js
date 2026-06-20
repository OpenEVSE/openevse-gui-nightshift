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

const SUPPORT_LINKS = [
  { labelKey: 'config.support.knowledge_base', url: 'https://openev.freshdesk.com/support/solutions' },
  { labelKey: 'config.support.guides', url: 'https://openevse.dozuki.com/' },
  { labelKey: 'config.support.discord', url: 'https://discord.com/invite/Y3ftbUd4rR' },
]

// Full-capability config: all 8 capability fields present so every gated page
// and every section (including the all-gated `energy` section) is visible.
const FULL = {
  mqtt_enabled: true,
  ocpp_enabled: true,
  rfid_enabled: true,
  mqtt_vehicle_soc: true,
  divert_enabled: true,
  current_shaper_enabled: true,
  emoncms_enabled: true,
  ohm_enabled: true,
}

describe('Settings hub', () => {
  it('renders the four section headings', () => {
    config_store.set(FULL)
    const { getByText } = render(Settings)
    for (const s of ['connectivity', 'charger', 'energy', 'system']) {
      expect(getByText('config.sections.' + s)).toBeInTheDocument()
    }
  })
  it('renders a link for every config page plus the support links', () => {
    config_store.set(FULL)
    const { getAllByRole } = render(Settings)
    const links = getAllByRole('link')
    expect(links).toHaveLength(SETTINGS_PAGES.length + SUPPORT_LINKS.length)
    for (const p of SETTINGS_PAGES) {
      expect(links.some((l) => l.getAttribute('href') === '#' + p.route)).toBe(true)
    }
  })
  it('hides gated sections when capability fields are absent', () => {
    config_store.set({})
    const { queryByText } = render(Settings)
    expect(queryByText('config.sections.energy')).toBeNull()
  })

  it('renders a Support section with external links opening in a new tab', () => {
    const { getByText, getByRole } = render(Settings)
    expect(getByText('config.sections.support')).toBeInTheDocument()
    for (const { labelKey, url } of SUPPORT_LINKS) {
      const link = getByRole('link', { name: labelKey })
      expect(link).toHaveAttribute('href', url)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  it('lays the section cards out as a two-column grid on desktop', () => {
    const { container, getByText } = render(Settings)
    expect(container.querySelector('section').className).toContain('lg:max-w-4xl')
    expect(container.querySelector('[class*="lg:grid-cols-2"]')).toBeTruthy()
    const supportCard = getByText('config.sections.support').closest('[class*="lg:col-span-2"]')
    expect(supportCard).toBeTruthy()
  })
})
