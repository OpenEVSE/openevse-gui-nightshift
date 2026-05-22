// src/lib/config/validate.js
// Pure field validators. Each returns { ok, msgKey } — msgKey is an i18n key
// or null when ok. Reused by config pages for inline validation hints.

export function isRequired(v) {
  const ok = v !== undefined && v !== null && String(v).trim() !== ''
  return { ok, msgKey: ok ? null : 'config.validation.required' }
}

export function inRange(v, min, max) {
  const n = Number(v)
  const ok = Number.isFinite(n) && n >= min && n <= max
  return { ok, msgKey: ok ? null : 'config.validation.range' }
}

export function isPort(v) {
  const n = Number(v)
  const ok = Number.isInteger(n) && n >= 1 && n <= 65535
  return { ok, msgKey: ok ? null : 'config.validation.port' }
}

export function isHostname(v) {
  const ok =
    typeof v === 'string' && v.length > 0 && v.length <= 253 && /^[a-zA-Z0-9.-]+$/.test(v)
  return { ok, msgKey: ok ? null : 'config.validation.hostname' }
}

// The device reports a saved password back as a masking sentinel, never the
// real value. A field still holding a sentinel must not be re-saved.
export function isDummyPassword(v) {
  return v === '_DUMMY_PASSWORD' || v === '••••••••••'
}
