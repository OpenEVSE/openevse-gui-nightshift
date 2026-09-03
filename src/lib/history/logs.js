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

// evseFlags bits worth naming (values from the OpenEVSE library's
// OPENEVSE_VFLAG_* defines). Listed in the order we surface them when several
// move in one entry: a latching fault first — it deserves a row of its own —
// then the relay, then connection / lock state. `set` is the reason when the
// bit goes 0→1, `clear` when it goes 1→0. Bits not listed (calibration,
// onboard-UI-menu, and the internal SESSION_ENDED / EV_CONNECTED_PREV
// bookkeeping) fall through to a generic reason rather than a blank row.
const FLAG_BITS = [
  { bit: 0x0080, set: 'flags_gfi_tripped', clear: 'flags_gfi_cleared' }, // GFI_TRIPPED
  { bit: 0x0020, set: 'flags_noground_tripped', clear: 'flags_noground_cleared' }, // NOGND_TRIPPED
  { bit: 0x0002, set: 'flags_fault', clear: 'flags_fault_cleared' }, // HARD_FAULT
  { bit: 0x0008, set: 'flags_auth_locked', clear: 'flags_auth_unlocked' }, // AUTH_LOCKED
  { bit: 0x0004, set: 'flags_limit_sleep', clear: 'flags_limit_cleared' }, // LIMIT_SLEEP
  { bit: 0x0040, set: 'flags_relay_closed', clear: 'flags_relay_opened' }, // CHARGING_ON
  { bit: 0x0100, set: 'flags_vehicle_connected', clear: 'flags_vehicle_disconnected' }, // EV_CONNECTED
  { bit: 0x4000, set: 'flags_boot_locked', clear: 'flags_boot_unlocked' }, // BOOT_LOCK
]

// Name the most significant evseFlags transition, never a raw bitmask. Returns
// a { code } descriptor. Falls back to a generic "status changed" — rather than
// null — whenever flags moved but no named bit explains it, or there is no
// predecessor to diff against, so a new-firmware row is never left blank.
function flagReason(entry, prev) {
  const to = Number(entry?.evseFlags)
  const from = Number(prev?.evseFlags)
  if (!Number.isFinite(to) || !Number.isFinite(from)) return { code: 'flags_changed' }
  const moved = to ^ from
  for (const { bit, set, clear } of FLAG_BITS) {
    if (moved & bit) return { code: to & bit ? set : clear }
  }
  return { code: 'flags_changed' }
}

// managerState is a string ("active" | "disabled"). It is NOT part of the row's
// state label — getStateDesc() reads evseState only — so a manager-only change
// would otherwise render nothing. Name the transition.
function managerReason(entry) {
  if (entry?.managerState === 'active') return { code: 'manager_active' }
  if (entry?.managerState === 'disabled') return { code: 'manager_disabled' }
  return { code: 'manager_changed' }
}

/**
 * Why this entry exists, as an i18n descriptor { code, params } — or null when
 * there is nothing worth surfacing (legacy entry, or a `state`-only change the
 * row's own label already shows). `prev` is the earlier-in-time entry; the
 * store is newest-first, so for rows[i] that is rows[i + 1] (null for the
 * oldest row).
 */
export function logReason(entry, prev) {
  const changed = Array.isArray(entry?.changed) ? entry.changed : []
  if (changed.length === 0) return null

  // The firmware only sets `periodic` when the mask is otherwise empty, so it
  // never combines with another reason. Branch on it first and skip the delta
  // path entirely — the row's numbers carry it, not a field transition.
  if (changed.includes('periodic')) return { code: 'periodic' }

  const has = (k) => changed.includes(k)

  // Most-informative first. `state` is intentionally absent: it alone restates
  // the row's own (already-visible) state label. Flags rank above pilot so a
  // relay/fault move wins over a same-value pilot entry at charge start;
  // `manager` sits low as a fallback since it is invisible on the row otherwise.
  return (
    (has('flags') && flagReason(entry, prev)) ||
    (has('pilot') && numericDelta('pilot', entry?.pilot, prev?.pilot)) ||
    (has('divert') && numericDelta('divert', entry?.divertMode, prev?.divertMode)) ||
    (has('shaper') && numericDelta('shaper', entry?.shaper, prev?.shaper)) ||
    (has('manager') && managerReason(entry)) ||
    (has('boot') && { code: 'boot' }) ||
    null
  )
}

// A "from → to" reason for a small numeric field. Falls back to the current
// value alone ("_now") when there is no predecessor (the oldest row) or the
// value did not actually move — a "47 → 47" arrow claims a change that isn't
// there. Null when the field itself is unreadable.
function numericDelta(code, rawTo, rawFrom) {
  const to = Number(rawTo)
  if (!Number.isFinite(to)) return null
  const from = Number(rawFrom)
  return Number.isFinite(from) && Math.round(from) !== Math.round(to)
    ? { code, params: { from: Math.round(from), to: Math.round(to) } }
    : { code: code + '_now', params: { to: Math.round(to) } }
}
