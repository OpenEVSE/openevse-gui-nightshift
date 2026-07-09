// Screenshot manifest — the single source of truth for `npm run screenshots`.
//
// Each entry produces one image per theme × viewport combination, named
// docs/screenshots/<name>-<theme>-<viewport>.png. Defaults (dark theme,
// desktop viewport, full-page) can be overridden per entry.
//
// Fields:
//   name      output filename stem (required, unique)
//   route     hash route to open, e.g. '/settings/evse' (required)
//   scenario  fixtures/scenarios/<scenario>.json overlay, or null for base
//   state     EVSE state override via /api/_mock/state/<code>
//             (1 idle, 2 connected, 3 charging, 4+ fault, 254 sleeping, 255 off)
//   themes    ['dark'] | ['light'] | ['dark', 'light']
//   viewports ['desktop'] | ['mobile'] | both
//   fullPage  capture the whole scroll height (default true)

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
}

// The moment every capture is frozen at (matches the status fixture's time,
// so on-screen clocks agree with session/timestamp data).
export const FROZEN_TIME = '2026-05-21T22:00:30Z'
export const TIMEZONE = 'America/New_York' // matches config fixture time_zone
export const LOCALE = 'en-US'

const defaults = { scenario: null, state: null, themes: ['dark'], viewports: ['desktop'], fullPage: true }

const entries = [
  // ── Main screens ──────────────────────────────────────────────────────────
  // Dashboard heroes: both themes and both form factors, in the richest state
  // (charging with solar divert + shaper active).
  { name: 'dashboard-charging', route: '/', themes: ['dark', 'light'], viewports: ['desktop', 'mobile'] },
  { name: 'dashboard-sleeping', route: '/', state: 254 },
  { name: 'dashboard-off', route: '/', state: 255 },
  { name: 'dashboard-fault', route: '/', state: 6 }, // GFCI fault
  { name: 'charge-manager', route: '/schedule', viewports: ['desktop', 'mobile'] },
  { name: 'schedule-legacy', route: '/schedule/legacy' },
  { name: 'monitoring', route: '/monitoring', viewports: ['desktop', 'mobile'] },
  { name: 'history', route: '/history', viewports: ['desktop', 'mobile'] },
  { name: 'wizard', route: '/', scenario: 'wizard', viewports: ['desktop', 'mobile'] },

  // ── Settings hub + pages ──────────────────────────────────────────────────
  { name: 'settings', route: '/settings', themes: ['dark', 'light'], viewports: ['desktop', 'mobile'] },
  { name: 'settings-network', route: '/settings/network' },
  { name: 'settings-http', route: '/settings/http' },
  { name: 'settings-mqtt', route: '/settings/mqtt' },
  { name: 'settings-ocpp', route: '/settings/ocpp' },
  { name: 'settings-evse', route: '/settings/evse' },
  { name: 'settings-safety', route: '/settings/safety' },
  { name: 'settings-time', route: '/settings/time' },
  { name: 'settings-rfid', route: '/settings/rfid' },
  { name: 'settings-vehicle', route: '/settings/vehicle' },
  { name: 'settings-solar', route: '/settings/solar' },
  { name: 'settings-shaper', route: '/settings/shaper' },
  { name: 'settings-emoncms', route: '/settings/emoncms' },
  { name: 'settings-ohmconnect', route: '/settings/ohmconnect' },
  { name: 'settings-firmware', route: '/settings/firmware' },
  { name: 'settings-certificates', route: '/settings/certificates' },
  { name: 'settings-terminal', route: '/settings/terminal' },
  { name: 'settings-display', route: '/settings/display', scenario: 'display' },
  { name: 'settings-about', route: '/settings/about' },
]

export const SHOTS = entries.map((e) => ({ ...defaults, ...e }))
