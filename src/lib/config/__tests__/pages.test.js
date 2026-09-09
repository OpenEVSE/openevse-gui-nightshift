// src/lib/config/__tests__/pages.test.js
import { describe, it, expect } from 'vitest'
import { SETTINGS_PAGES, SECTIONS, pagesBySection } from '../pages.js'

describe('SETTINGS_PAGES', () => {
  it('lists all 19 config pages', () => {
    expect(SETTINGS_PAGES).toHaveLength(19)
  })
  it('every page has key, route, icon, labelKey, section', () => {
    for (const p of SETTINGS_PAGES) {
      expect(p.key).toBeTruthy()
      expect(p.route).toMatch(/^\/settings\//)
      expect(p.icon).toBeTruthy()
      expect(p.labelKey).toMatch(/^config\.pages\./)
      expect(SECTIONS).toContain(p.section)
    }
  })
  it('routes are unique', () => {
    const routes = SETTINGS_PAGES.map((p) => p.route)
    expect(new Set(routes).size).toBe(routes.length)
  })
  it('keys are unique', () => {
    const keys = SETTINGS_PAGES.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('SECTIONS', () => {
  it('is the four themed sections in order', () => {
    expect(SECTIONS).toEqual(['connectivity', 'charger', 'energy', 'system'])
  })
})

describe('pagesBySection', () => {
  it('groups every page under its section, no section empty', () => {
    // tft_theme present so the capability-gated Display page is included;
    // cloud_enabled present so the Cloud page is; dev_features on so the
    // Labs-gated Load Sharing page is too.
    const grouped = pagesBySection(
      { tft_theme: 'dark', cloud_enabled: false },
      { dev_features: true },
    )
    expect(grouped).toHaveLength(4)
    let total = 0
    for (const g of grouped) {
      expect(SECTIONS).toContain(g.section)
      expect(g.pages.length).toBeGreaterThan(0)
      total += g.pages.length
    }
    expect(total).toBe(19)
  })
  it('gates the Display page on tft_theme presence', () => {
    const keysFor = (config) =>
      pagesBySection(config, { dev_features: true }).flatMap((g) => g.pages.map((p) => p.key))
    expect(keysFor({})).not.toContain('display')
    expect(keysFor({ tft_theme: 'dark' })).toContain('display')
  })
  it('gates the Cloud page on cloud_enabled being present, not on its value', () => {
    const keysFor = (config) =>
      pagesBySection(config).flatMap((g) => g.pages.map((p) => p.key))
    expect(keysFor({})).not.toContain('cloud')
    expect(keysFor(undefined)).not.toContain('cloud')
    expect(keysFor({ cloud_enabled: true })).toContain('cloud')
    // The case a plain `requires` would get wrong: the connection is switched
    // off, which is exactly when the owner needs the page to turn it back on.
    expect(keysFor({ cloud_enabled: false })).toContain('cloud')
  })
  it('gates the Load Sharing page on the dev_features (Labs) flag', () => {
    const keysFor = (opts) =>
      pagesBySection({ tft_theme: 'dark' }, opts).flatMap((g) => g.pages.map((p) => p.key))
    expect(keysFor({ dev_features: false })).not.toContain('loadsharing')
    expect(keysFor(undefined)).not.toContain('loadsharing')
    expect(keysFor({ dev_features: true })).toContain('loadsharing')
  })
  it('preserves section order', () => {
    expect(pagesBySection({}).map((g) => g.section)).toEqual(SECTIONS)
  })
  it('still shows non-gated pages with no config', () => {
    const groups = pagesBySection(undefined)
    const keys = groups.flatMap((g) => g.pages.map((p) => p.key))
    expect(keys).toContain('network')
  })
})
