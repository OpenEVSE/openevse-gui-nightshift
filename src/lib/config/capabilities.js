// src/lib/config/capabilities.js
// Data-driven capability gating: the device's own /config tells us which
// settings pages it supports. A page with a `requires` field whose key is
// absent from /config is unreachable.
import { SETTINGS_PAGES } from './pages.js'

/** Settings routes whose required config field is absent → unreachable. */
export function blockedSettingsRoutes(config) {
  return SETTINGS_PAGES
    .filter((p) => p.requires && !(config != null && p.requires in config))
    .map((p) => p.route)
}
