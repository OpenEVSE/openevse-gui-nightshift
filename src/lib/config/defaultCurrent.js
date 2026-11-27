// src/lib/config/defaultCurrent.js
// No imports: shared by the config store and the pure dashboard/monitoring
// helpers.

/**
 * The default (boot) current from a /config object: `default_current`, or
 * `max_current_soft` from firmware before openevse_esp32_firmware#1412. It is
 * the current the station starts at (saved to the controller with `$SC amps`),
 * not a ceiling; the ceiling is max_current_hard (see hardMaxCurrent).
 * @param {any} config
 * @param {any} [fallback]
 */
export function defaultCurrent(config, fallback = undefined) {
  return config?.default_current ?? config?.max_current_soft ?? fallback
}
