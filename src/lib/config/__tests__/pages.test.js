// src/lib/config/__tests__/pages.test.js
import { describe, it, expect } from 'vitest'
import { SETTINGS_PAGES, SECTIONS, pagesBySection } from '../pages.js'

describe('SETTINGS_PAGES', () => {
  it('lists all 18 config pages', () => {
    expect(SETTINGS_PAGES).toHaveLength(18)
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
    // labs_enabled on so the Labs-gated Load Sharing page is included too.
    const grouped = pagesBySection({ tft_theme: 'dark', labs_enabled: true })
    expect(grouped).toHaveLength(4)
    let total = 0
    for (const g of grouped) {
      expect(SECTIONS).toContain(g.section)
      expect(g.pages.length).toBeGreaterThan(0)
      total += g.pages.length
    }
    expect(total).toBe(18)
  })
  it('gates the Display page on either display key being present', () => {
    // A TFT build sends tft_theme; a controller with the 2-line character LCD
    // (no TFT) sends lcd_type. Either is a display to configure.
    const keysFor = (config) =>
      pagesBySection({ ...config, labs_enabled: true }).flatMap((g) => g.pages.map((p) => p.key))
    expect(keysFor({})).not.toContain('display')
    expect(keysFor({ tft_theme: 'dark' })).toContain('display')
    expect(keysFor({ lcd_type: 'rgb' })).toContain('display')
    expect(keysFor({ tft_theme: 'dark', lcd_type: 'mono' })).toContain('display')
  })
  it('gates the Load Sharing page on the labs_enabled (Labs) config flag', () => {
    const keysFor = (config) => pagesBySection(config).flatMap((g) => g.pages.map((p) => p.key))
    expect(keysFor({ labs_enabled: false })).not.toContain('loadsharing')
    expect(keysFor(undefined)).not.toContain('loadsharing')
    expect(keysFor({ labs_enabled: true })).toContain('loadsharing')
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
