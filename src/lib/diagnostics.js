// src/lib/diagnostics.js
// Collect a snapshot of every store into a single JSON blob the user can
// download for a bug report. Secrets are scrubbed automatically so the file
// is safe-by-default to share.

import { get } from 'svelte/store'
import { config_store } from './stores/config.js'
import { status_store } from './stores/status.js'
import { schedule_store } from './stores/schedule.js'
import { plan_store } from './stores/plan.js'
import { override_store } from './stores/override.js'
import { claims_target_store } from './stores/claims_target.js'
import { limit_store } from './stores/limit.js'
import { certificate_store } from './stores/certificates.js'
import { uistates_store } from './stores/uistates.js'
import { uisettings_store } from './stores/uisettings.js'
import { theme } from './stores/theme.js'

// Field names whose value should be replaced with a placeholder before export.
// Substring match against the lowercased key — broad on purpose so we catch
// new "*_password" or "*_token" fields without code changes.
const SECRET_PATTERNS = [
  'pass', // ap_pass, mqtt_pass, http password
  'authkey',
  'token',
  'apikey',
  'api_key',
  'secret',
]

const PLACEHOLDER = '***REDACTED***'

function looksSecret(key) {
  const k = String(key).toLowerCase()
  return SECRET_PATTERNS.some((p) => k.includes(p))
}

/** Deep-clone with secret fields blanked out. Safe for arbitrary nesting. */
export function scrubSecrets(value) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(scrubSecrets)
  const out = {}
  for (const [k, v] of Object.entries(value)) {
    out[k] = looksSecret(k) && v ? PLACEHOLDER : scrubSecrets(v)
  }
  return out
}

/** Build the diagnostic snapshot object. Exposed so tests can assert shape. */
export function buildDiagnostics({ now = new Date() } = {}) {
  return {
    generated_at: now.toISOString(),
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    config: scrubSecrets(get(config_store) ?? null),
    status: scrubSecrets(get(status_store) ?? null),
    schedule: scrubSecrets(get(schedule_store) ?? null),
    plan: scrubSecrets(get(plan_store) ?? null),
    override: scrubSecrets(get(override_store) ?? null),
    claims_target: scrubSecrets(get(claims_target_store) ?? null),
    limit: scrubSecrets(get(limit_store) ?? null),
    certificates: scrubSecrets(get(certificate_store) ?? null),
    uistates: scrubSecrets(get(uistates_store) ?? null),
    uisettings: scrubSecrets(get(uisettings_store) ?? null),
    theme: get(theme) ?? null,
  }
}

/**
 * Trigger a browser download of the diagnostic snapshot. Returns the filename
 * used so callers can show a toast / log it. Lives in this module so the
 * UI component doesn't have to know anything about Blobs and anchor tags.
 */
export function downloadDiagnostics() {
  const data = buildDiagnostics()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `openevse-diagnostics-${stamp}.json`

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoke so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filename
}
