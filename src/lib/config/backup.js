// src/lib/config/backup.js
// Produces a config object safe to download as a backup: device-identity /
// capability fields and masked-password fields are removed.

const STRIP_KEYS = new Set([
  'www_username', 'ssid', 'mqtt_supported_protocols', 'http_supported_protocols',
  'firmware', 'protocol', 'espflash', 'espinfo', 'buildenv', 'build_env',
  'version', 'evse_serial', 'wifi_serial',
])

export function sanitizeConfig(config) {
  const out = {}
  for (const [key, value] of Object.entries(config ?? {})) {
    if (STRIP_KEYS.has(key)) continue
    if (value === '_DUMMY_PASSWORD') continue
    out[key] = value
  }
  return out
}
