/**
 * Pure helpers for notification advisories.
 *
 * An advisory is a condition the owner should know about that is *not* a
 * fault: a safety check switched off, a fault that has already cleared,
 * thermal state, relay wear. They sit below the full-screen fault page ("this
 * charger has stopped") and above the event log (history you go looking for).
 *
 * Self-contained — no store, DOM or API imports. Every shape below is read
 * from the firmware's own serialiser (src/notifications.cpp), not from a spec.
 */

/** Severity names, weakest first. The firmware sends exactly these three. */
export const SEVERITIES = ['info', 'warning', 'critical']

/** 0 (info) … 2 (critical). Anything unrecognised ranks lowest. */
export function severityRank(severity) {
  const i = SEVERITIES.indexOf(severity)
  return i < 0 ? 0 : i
}

/** The strongest severity in a list, or 'info' for an empty one. */
export function maxSeverity(items) {
  let rank = 0
  for (const item of items ?? []) rank = Math.max(rank, severityRank(item?.severity))
  return SEVERITIES[rank]
}

/**
 * Where each advisory sends the reader.
 *
 * `setting` is the config key whose switch this advisory is about — the inline
 * marker on the settings page is drawn from it, and it is the whole point of
 * the feature: "ground check is off" is only actionable if it is one tap from
 * the control that fixes it.
 *
 * `route` is where the panel's link goes. Relay wear and the relay's thermal
 * state point at Monitoring → Health, which already renders life remaining,
 * cold opens, electrical damage, transit drift and the thermal index. An
 * advisory's job is to tell someone who isn't on that page that they should
 * be — never to restate the figure.
 *
 * Severity is deliberately absent: two ids change severity with condition
 * (wear.relay_life at ≤20% / ≤5% remaining, thermal.relay_thermal at watch /
 * warn), so it is read from the payload, never from a table.
 */
export const ADVISORIES = {
  'safety.ground_check': { category: 'safety', setting: 'ground_check', route: '/settings/safety' },
  'safety.gfci_check': { category: 'safety', setting: 'gfci_check', route: '/settings/safety' },
  'safety.relay_check': { category: 'safety', setting: 'relay_check', route: '/settings/safety' },
  'safety.diode_check': { category: 'safety', setting: 'diode_check', route: '/settings/safety' },
  'safety.vent_check': { category: 'safety', setting: 'vent_check', route: '/settings/safety' },
  'safety.temp_check': { category: 'safety', setting: 'temp_check', route: '/settings/safety' },
  'fault.gfci_tripped': { category: 'fault', route: '/monitoring/health' },
  'fault.no_ground': { category: 'fault', route: '/monitoring/health' },
  'fault.stuck_relay': { category: 'fault', route: '/monitoring/health' },
  'thermal.throttling': { category: 'thermal', route: '/settings/safety' },
  'thermal.high_temp': { category: 'thermal', route: '/settings/safety' },
  'thermal.relay_thermal': { category: 'thermal', route: '/monitoring/health' },
  'wear.relay_life': { category: 'wear', route: '/monitoring/health' },
  'wear.relay_transit_drift': { category: 'wear', route: '/monitoring/health' },
  'wear.relay_cold_open': { category: 'wear', route: '/monitoring/health' },
  'wear.stuck_relay_recovery': { category: 'wear', route: '/monitoring/health' },
}

/** The ids this build has title and detail copy for. */
export const KNOWN_ADVISORY_IDS = Object.keys(ADVISORIES)

/**
 * True when this build knows the id. Ids are stable and locale-independent —
 * all display text is ours — so a firmware that adds one ships an id we have
 * no copy for. Callers fall back to the raw id rather than a missing-key
 * placeholder.
 */
export function isKnownAdvisory(id) {
  return Object.prototype.hasOwnProperty.call(ADVISORIES, id)
}

/** Where the panel's link for this advisory should go; null when unknown. */
export function advisoryRoute(id) {
  return ADVISORIES[id]?.route ?? null
}

/**
 * Epoch seconds → a number, or null when the charger could not say.
 *
 * `0` means "the clock was not yet synced when this was recorded" — render it
 * as unknown, never as 1970.
 */
export function seenAt(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Normalise a GET /notifications body into { count, severity, items }.
 *
 * `count` and `severity` are the badge numbers and cover **unmuted** entries
 * only; `items` lists everything, muted included. So `count: 0` beside a
 * non-empty `items` is a legitimate payload, not a bug.
 */
export function normalizeNotifications(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { count: 0, severity: 'info', items: [] }
  }
  const raw = Array.isArray(payload.notifications) ? payload.notifications : []
  const items = raw
    .filter((n) => n && typeof n === 'object' && typeof n.id === 'string' && n.id !== '')
    .map((n) => ({
      id: n.id,
      category: typeof n.category === 'string' ? n.category : '',
      severity: SEVERITIES.includes(n.severity) ? n.severity : 'info',
      sticky: !!n.sticky,
      acked: !!n.acked,
      first_seen: seenAt(n.first_seen),
      last_seen: seenAt(n.last_seen),
    }))
  const live = unmutedItems(items)
  const count = Number(payload.count)
  return {
    // Prefer the firmware's own figures; recompute only when they are missing
    // or unusable, so the badge never disagrees with the LCD.
    count: Number.isFinite(count) && count >= 0 ? count : live.length,
    severity: SEVERITIES.includes(payload.max_severity)
      ? payload.max_severity
      : maxSeverity(live),
    items,
  }
}

/** The entries that drive the badge and the LCD — everything not acked. */
export function unmutedItems(items) {
  return (items ?? []).filter((n) => n && !n.acked)
}

/** Unmuted criticals, in display order. What the status-page strip shows. */
export function criticalItems(items) {
  return sortNewestFirst(unmutedItems(items).filter((n) => n.severity === 'critical'))
}

/**
 * Newest first — by `first_seen`, i.e. most recently *raised*.
 *
 * Not by `last_seen`: the firmware stamps that on every live advisory each
 * five-second pass, so for anything currently raised it is simply "now" and
 * orders nothing.
 *
 * An advisory whose timestamps are unknown (the clock had not synced when it
 * was recorded) sorts after the dated ones rather than to the top, where a 0
 * would otherwise put it; severity then id break the ties so the order is
 * stable across re-fetches.
 */
export function sortNewestFirst(items) {
  return [...(items ?? [])].sort((a, b) => {
    const at = a?.first_seen ?? a?.last_seen
    const bt = b?.first_seen ?? b?.last_seen
    if (at !== bt) {
      if (at == null) return 1
      if (bt == null) return -1
      return bt - at
    }
    const sev = severityRank(b?.severity) - severityRank(a?.severity)
    if (sev !== 0) return sev
    return String(a?.id ?? '').localeCompare(String(b?.id ?? ''))
  })
}

/**
 * Config key → the advisory sitting on it, for the settings-page inline
 * markers.
 *
 * Muted entries are included deliberately: acking silences the alarm, it never
 * hides the state. The owner who muted "ground check is off" still sees it
 * beside the switch, so the charger's configuration is never secret.
 */
export function settingsMarkers(items) {
  const out = {}
  for (const item of items ?? []) {
    const setting = ADVISORIES[item?.id]?.setting
    if (!setting) continue
    // Two advisories can never name the same switch, but if firmware ever
    // makes that true, the louder one wins the marker.
    if (out[setting] && severityRank(out[setting].severity) >= severityRank(item.severity)) continue
    out[setting] = { id: item.id, severity: item.severity, acked: !!item.acked }
  }
  return out
}

/**
 * Capability gate: does this firmware have the advisory engine at all?
 *
 * The test is the *presence* of the `notifications` object in GET /status,
 * never its contents — a charger with nothing to report sends
 * `{count: 0, severity: "info"}`, which is every bit as much a yes as a
 * charger with six advisories.
 */
export function hasNotifications(status) {
  return !!(
    status &&
    typeof status === 'object' &&
    status.notifications &&
    typeof status.notifications === 'object' &&
    !Array.isArray(status.notifications)
  )
}

/**
 * The two /status fields as one comparable string, or null on a build without
 * the feature. This is the re-fetch trigger: the firmware pushes these two
 * over the websocket whenever the live set changes, and the list itself only
 * ever arrives from GET /notifications — there is no per-item push.
 *
 * Note what this cannot see: acking changes `count` but not the live set, so
 * the firmware sends no event for it. The ack path re-downloads for itself
 * rather than waiting for a signature that will not move.
 */
export function badgeSignature(status) {
  if (!hasNotifications(status)) return null
  const n = status.notifications
  const count = Number(n.count)
  return (Number.isFinite(count) ? count : 0) + ':' + String(n.severity ?? 'info')
}
