// src/lib/temperature.js
// Pure °C ↔ °F conversion and display helpers. The device always reports
// temperature in °C; this module owns the conversion + the i18n key for
// whichever unit the user prefers (uisettings.temp_unit: 'c' | 'f').

/** Convert a °C number to °F, rounded to 1 dp. NaN-safe. */
export function cToF(c) {
  if (c === null || c === undefined || !Number.isFinite(Number(c))) return null
  return Math.round((Number(c) * 9 / 5 + 32) * 10) / 10
}

/** Round a °C number to 1 dp. NaN-safe. */
export function roundC(c) {
  if (c === null || c === undefined || !Number.isFinite(Number(c))) return null
  return Math.round(Number(c) * 10) / 10
}

/**
 * Format a °C value for display in the user's chosen unit.
 * Returns `{ value, unitKey }` so callers can render with svelte-i18n.
 * Pass `unit = 'f'` for Fahrenheit; anything else is treated as Celsius.
 */
export function formatTemp(celsius, unit) {
  const isF = unit === 'f'
  if (celsius === null || celsius === undefined || !Number.isFinite(Number(celsius))) {
    return { value: null, unitKey: isF ? 'units.fahrenheit' : 'units.celsius' }
  }
  return {
    value: isF ? cToF(celsius) : roundC(celsius),
    unitKey: isF ? 'units.fahrenheit' : 'units.celsius',
  }
}
