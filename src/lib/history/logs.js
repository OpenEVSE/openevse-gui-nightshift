/** Pure helpers for the History screen. Self-contained — no store/DOM/utils imports. */

/** The inclusive list of page indices [min … max], or [] for an invalid range. */
export function pageRange(min, max) {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) return []
  const out = []
  for (let i = min; i <= max; i++) out.push(i)
  return out
}

const TYPE_ICON = {
  information: 'mdi:information-outline',
  notification: 'mdi:bell-outline',
  warning: 'mdi:alert',
}

/** An mdi icon name for an event type. */
export function logTypeIcon(type) {
  return TYPE_ICON[type] ?? 'mdi:circle-small'
}

/** Tone ('info' | 'error' | 'muted') for an event type. */
export function logTypeTone(type) {
  if (type === 'warning') return 'error'
  if (type === 'information' || type === 'notification') return 'info'
  return 'muted'
}

/** An mdi icon name + tone for an EVSE state code. */
export function logStateInfo(evseState) {
  switch (evseState) {
    case 0: return { icon: 'mdi:rocket-launch-outline', tone: 'info' }
    case 1: return { icon: 'mdi:car-off', tone: 'muted' }
    case 2: return { icon: 'mdi:car', tone: 'ok' }
    case 3: return { icon: 'mdi:flash', tone: 'charging' }
    case 254:
    case 255: return { icon: 'mdi:cancel', tone: 'muted' }
    default:
      if (evseState >= 4 && evseState <= 11) return { icon: 'mdi:shield-alert', tone: 'error' }
      return { icon: 'mdi:help-circle-outline', tone: 'muted' }
  }
}

/** Round to 1 decimal; 0 for non-numeric input. */
function round1(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 10) / 10
}

/** Session energy in watt-hours → kWh (1 dp); 0 when absent. */
export function logEnergyKwh(entry) {
  return round1((entry?.energy ?? 0) / 1000)
}

/** Entry temperature in °C (1 dp); 0 when absent. */
export function logTempC(entry) {
  return round1(entry?.temperature ?? 0)
}

/** The advertised pilot current in whole amps, or null when absent/non-finite. */
export function logPilotAmps(entry) {
  const n = Number(entry?.pilot)
  return Number.isFinite(n) ? Math.round(n) : null
}

// evseFlags bits we can name. Anything else is left unlabelled rather than
// dumped as a number — a raw "1344 → 1280" helps nobody.
const FLAG_RELAY = 0x0040 // charging relay energised
const FLAG_VEHICLE = 0x0100 // EV connected

// The one flag transition we surface, most-significant first: a relay move
// beats a connect/disconnect when both bits flip in the same entry.
function flagReason(entry, prev) {
  const to = Number(entry?.evseFlags)
  const from = Number(prev?.evseFlags)
  if (!Number.isFinite(to) || !Number.isFinite(from)) return null
  const moved = to ^ from
  if (moved & FLAG_RELAY) return to & FLAG_RELAY ? 'flags_relay_closed' : 'flags_relay_opened'
  if (moved & FLAG_VEHICLE)
    return to & FLAG_VEHICLE ? 'flags_vehicle_connected' : 'flags_vehicle_disconnected'
  return null
}

/**
 * Why this entry exists, as an i18n descriptor { code, params } — or null when
 * there is nothing worth surfacing (legacy entry, or a reason the row's own
 * state label already shows). `prev` is the earlier-in-time entry; the store is
 * newest-first, so for rows[i] that is rows[i + 1] (null for the oldest row).
 */
export function logReason(entry, prev) {
  const changed = Array.isArray(entry?.changed) ? entry.changed : []
  if (changed.length === 0) return null

  // The firmware only sets `periodic` when the mask is otherwise empty, so it
  // never combines with another reason. Branch on it first and skip the delta
  // path entirely — the row's numbers carry it, not a field transition.
  if (changed.includes('periodic')) return { code: 'periodic' }

  // `state` / `manager` restate the row's own (already-visible) state label, so
  // they are never surfaced on their own. Order the rest most-informative first.
  if (changed.includes('pilot')) return numericDelta('pilot', entry?.pilot, prev?.pilot)
  if (changed.includes('flags')) {
    const code = flagReason(entry, prev)
    return code ? { code } : null
  }
  if (changed.includes('divert')) return numericDelta('divert', entry?.divertMode, prev?.divertMode)
  if (changed.includes('shaper')) return numericDelta('shaper', entry?.shaper, prev?.shaper)
  if (changed.includes('boot')) return { code: 'boot' }
  return null
}

// A "from → to" reason for a small numeric field. Falls back to the current
// value alone when there is no predecessor (the oldest row). Null when the
// field itself is unreadable.
function numericDelta(code, rawTo, rawFrom) {
  const to = Number(rawTo)
  if (!Number.isFinite(to)) return null
  const from = Number(rawFrom)
  return Number.isFinite(from)
    ? { code, params: { from: Math.round(from), to: Math.round(to) } }
    : { code: code + '_now', params: { to: Math.round(to) } }
}
