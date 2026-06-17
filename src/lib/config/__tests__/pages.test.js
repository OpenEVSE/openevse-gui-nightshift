// src/lib/config/__tests__/pages.test.js
import { describe, it, expect } from 'vitest'
import { SETTINGS_PAGES, SECTIONS, pagesBySection } from '../pages.js'

describe('SETTINGS_PAGES', () => {
  it('lists all 17 config pages', () => {
    expect(SETTINGS_PAGES).toHaveLength(17)
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
  // A config that reports every gateable feature (present, value irrelevant).
  const FULL = {
    mqtt_enabled: false, ocpp_enabled: false, rfid_enabled: false,
    divert_enabled: false, current_shaper_enabled: false,
    emoncms_enabled: false, ohm_enabled: false, mqtt_vehicle_soc: '',
  }

  it('shows all 17 pages when every capability is reported', () => {
    const grouped = pagesBySection(FULL)
    const total = grouped.reduce((n, g) => n + g.pages.length, 0)
    expect(total).toBe(17)
  })
  it('preserves section order', () => {
    expect(pagesBySection(FULL).map((g) => g.section)).toEqual(SECTIONS)
  })
  it('always shows non-gated pages even with an empty config', () => {
    const keys = pagesBySection({}).flatMap((g) => g.pages.map((p) => p.key))
    expect(keys).toEqual(expect.arrayContaining(['network', 'http', 'evse', 'safety', 'time', 'firmware', 'about']))
  })
  it('hides a gated page when its required field is absent', () => {
    const keys = pagesBySection({}).flatMap((g) => g.pages.map((p) => p.key))
    expect(keys).not.toContain('ocpp')
    expect(keys).not.toContain('rfid')
  })
  it('shows a gated page when the field is present but falsy', () => {
    const keys = pagesBySection({ ocpp_enabled: false }).flatMap((g) => g.pages.map((p) => p.key))
    expect(keys).toContain('ocpp')
  })
  it('hides certificates without ocpp_enabled but shows it once reported', () => {
    expect(pagesBySection({}).flatMap((g) => g.pages.map((p) => p.key))).not.toContain('certificates')
    expect(pagesBySection({ ocpp_enabled: false }).flatMap((g) => g.pages.map((p) => p.key))).toContain('certificates')
  })
  it('drops a section that has no visible pages', () => {
    const sections = pagesBySection({}).map((g) => g.section)
    expect(sections).not.toContain('energy')
    expect(sections).toContain('connectivity')
  })
})
