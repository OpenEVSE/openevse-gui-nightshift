// src/lib/config/shellyLnm.js
// Pure helpers for the Shelly LNM settings page.

export const POWER_FIELDS = ['act_power', 'total_act_power', 'a_act_power', 'b_act_power', 'c_act_power']
export const VOLTAGE_FIELDS = ['voltage', 'a_voltage', 'b_voltage', 'c_voltage']

// Firmware reports UINT32_MAX (or nothing) while no power sample was received.
const NO_DATA = 0xffffffff

export function hasData(ageMs) {
  return typeof ageMs === 'number' && ageMs !== NO_DATA
}

export function formatDataAge(ageMs) {
  return hasData(ageMs) ? `${ageMs} ms` : null
}

// Shelly LNM pushes about once a second: >5 s is late, >10 s is stale.
export function dataAgeTone(ageMs) {
  if (!hasData(ageMs)) return 'error'
  if (ageMs > 10000) return 'error'
  if (ageMs > 5000) return 'warn'
  return 'ok'
}
