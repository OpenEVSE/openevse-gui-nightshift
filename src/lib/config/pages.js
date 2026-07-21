// src/lib/config/pages.js
// The single source of truth for the Settings page catalogue.
// The hub, the nav, the placeholder route, and tests all read from here.

export const SECTIONS = ['connectivity', 'charger', 'energy', 'system']

export const SETTINGS_PAGES = [
  // Connectivity
  { key: 'network', route: '/settings/network', icon: 'mdi:wifi', labelKey: 'config.pages.network', section: 'connectivity' },
  { key: 'http', route: '/settings/http', icon: 'mdi:web', labelKey: 'config.pages.http', section: 'connectivity' },
  { key: 'mqtt', route: '/settings/mqtt', icon: 'mdi:transit-connection-variant', labelKey: 'config.pages.mqtt', section: 'connectivity' },
  { key: 'ocpp', route: '/settings/ocpp', icon: 'mdi:ev-station', labelKey: 'config.pages.ocpp', section: 'connectivity' },
  // Charger
  { key: 'evse', route: '/settings/evse', icon: 'mdi:car-electric', labelKey: 'config.pages.evse', section: 'charger' },
  { key: 'safety', route: '/settings/safety', icon: 'mdi:shield-check-outline', labelKey: 'config.pages.safety', section: 'charger' },
  { key: 'time', route: '/settings/time', icon: 'mdi:clock-outline', labelKey: 'config.pages.time', section: 'charger' },
  { key: 'rfid', route: '/settings/rfid', icon: 'mdi:nfc-variant', labelKey: 'config.pages.rfid', section: 'charger' },
  { key: 'vehicle', route: '/settings/vehicle', icon: 'mdi:car', labelKey: 'config.pages.vehicle', section: 'charger' },
  // Energy
  { key: 'solar', route: '/settings/solar', icon: 'mdi:solar-power', labelKey: 'config.pages.solar', section: 'energy' },
  { key: 'loadsharing', route: '/settings/loadsharing', icon: 'mdi:connection', labelKey: 'config.pages.loadsharing', section: 'energy' },
  { key: 'shaper', route: '/settings/shaper', icon: 'mdi:chart-bell-curve', labelKey: 'config.pages.shaper', section: 'energy' },
  { key: 'emoncms', route: '/settings/emoncms', icon: 'mdi:chart-box-outline', labelKey: 'config.pages.emoncms', section: 'energy' },
  { key: 'ohmconnect', route: '/settings/ohmconnect', icon: 'mdi:flash-outline', labelKey: 'config.pages.ohmconnect', section: 'energy' },
  // System
  { key: 'firmware', route: '/settings/firmware', icon: 'mdi:chip', labelKey: 'config.pages.firmware', section: 'system' },
  { key: 'certificates', route: '/settings/certificates', icon: 'mdi:certificate', labelKey: 'config.pages.certificates', section: 'system' },
  { key: 'terminal', route: '/settings/terminal', icon: 'mdi:console', labelKey: 'config.pages.terminal', section: 'system' },
  // Only present on firmware with the on-device LVGL TFT panel — `tft_theme`
  // appears in /config there, so it doubles as the "has a panel" capability gate.
  { key: 'display', route: '/settings/display', icon: 'mdi:monitor', labelKey: 'config.pages.display', section: 'system', requires: 'tft_theme' },
  { key: 'about', route: '/settings/about', icon: 'mdi:information-outline', labelKey: 'config.pages.about', section: 'system' },
]

export function pagesBySection(config) {
  return SECTIONS.map((section) => ({
    section,
    pages: SETTINGS_PAGES.filter(
      (p) => p.section === section && (!p.requires || (config && config[p.requires])),
    ),
  })).filter((g) => g.pages.length > 0)
}
