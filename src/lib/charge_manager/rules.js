/** Pure helpers for the Charge Manager. No store or DOM access — fully unit-tested. */

import { nextTimerId } from '../schedule/timers.js'

/** All supported global feature keys, in display order. */
export const GLOBAL_FEATURE_KEYS = [
  'session_limit',
  'eco_divert',
  'shaping',
  'rfid',
  'ocpp',
]

/**
 * Maps a Rule action to the timer `state` string the firmware expects.
 * EvseState::fromString only recognises 'a'→active and 'd'→disabled, so every
 * feature-enabled action (including 'eco') must use 'active' + the feature field.
 * @param {string} action
 */
export function actionToTimerState(action) {
  // Reboot is stored as a disabled-state timer: firmware that predates the
  // 'reboot' feature then reads it as a plain stop, never as a charge start.
  if (action === 'disable' || action === 'reboot') return 'disabled'
  return 'active'
}

/**
 * Maps a Rule action to the firmware `feature` field value.
 * 'eco' is treated as an alias for 'eco_divert' because the firmware has no
 * native Eco EvseState — divert's eco mode is the correct implementation.
 * @param {string} action
 * @returns {string|null}
 */
function actionToTimerFeature(action) {
  /** @type {Record<string,string>} */
  const map = { eco: 'divert', eco_divert: 'divert', shaper: 'shaper', rfid: 'rfid', ocpp: 'ocpp', reboot: 'reboot' }
  return map[action] ?? null
}

/**
 * Maps a Rule action to the global "Always Active" feature key it corresponds
 * to, or null for actions (charge / disable) that have no on/off global feature.
 * Used to keep a feature mutually exclusive between Always-On and Scheduled.
 * @param {string} action
 * @returns {string|null}
 */
export function actionToFeatureKey(action) {
  switch (action) {
    case 'eco_divert': return 'eco_divert'
    case 'shaper':     return 'shaping'
    case 'rfid':       return 'rfid'
    case 'ocpp':       return 'ocpp'
    default:           return null
  }
}

/**
 * Whether Eco divert is Always Active: solar divert is set up and the default
 * charge mode is Eco, which is also what the firmware boots into.
 * @param {Record<string, any>|undefined} config
 * @returns {boolean}
 */
export function ecoDivertAlwaysOn(config) {
  return !!config?.divert_enabled && config?.charge_mode === 'eco'
}

/**
 * The config write that turns an Always Active feature on or off, or null for
 * actions with no on/off flag (session limit, charge, disable).
 *
 * The firmware boots into Eco only when divert_enabled and charge_mode is eco
 * (openevse_esp32_firmware#1342), so turning Eco divert on writes both.
 * divert_enabled defaults off and nothing else in the UI sets it. Turning it
 * off writes charge_mode alone and leaves divert_enabled set, so the
 * dashboard's Eco button stays available.
 * @param {string} action
 * @param {boolean} on
 * @returns {Record<string, string|boolean>|null}
 */
export function alwaysOnConfig(action, on) {
  switch (action) {
    case 'eco_divert': return on ? { divert_enabled: true, charge_mode: 'eco' } : { charge_mode: 'fast' }
    case 'shaper': return { current_shaper_enabled: on }
    case 'rfid':   return { rfid_enabled: on }
    case 'ocpp':   return { ocpp_enabled: on }
    default:       return null
  }
}

/**
 * Maps a timer `state` + optional `feature` back to a Rule action.
 * `state === 'eco'` handles old-format timers stored before this format change.
 * @param {string} state
 * @param {string|null} [feature]
 */
export function timerStateToAction(state, feature = null) {
  if (feature === 'reboot') return 'reboot'
  if (state === 'disabled') return 'disable'
  if (state === 'eco') return 'eco_divert'   // old-format backward compat
  if (feature === 'divert') return 'eco_divert'
  if (feature === 'shaper') return 'shaper'
  if (feature === 'rfid') return 'rfid'
  if (feature === 'ocpp') return 'ocpp'
  return 'charge'
}

/**
 * Returns true when stopTime wraps past midnight relative to startTime.
 * e.g. start=23:00, stop=01:00 → true (stop is next calendar day).
 * @param {string} startTime
 * @param {string} stopTime
 */
export function isNextDay(startTime, stopTime) {
  if (!startTime || !stopTime) return false
  const toMins = (/** @type {string} */ t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  return toMins(stopTime) <= toMins(startTime)
}

/**
 * Shift each day name forward by one calendar day.
 * Used so stop-timer days align correctly when a window wraps past midnight.
 * @param {string[]} days
 * @returns {string[]}
 */
function shiftDaysForward(days) {
  const order = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days.map((/** @type {string} */ d) => { const i = order.indexOf(d); return i === -1 ? d : order[(i + 1) % 7] })
}

/**
 * Derive Rule[] from a flat list of backend timer events.
 *
 * Pairing, most deterministic first:
 *  1. Id-adjacency — rulesToTimers writes stopId = startId + 1, so a disabled
 *     timer at A.id + 1 that is also day/time-consistent is A's stop, even
 *     when several stops share the same day set.
 *  2. Same-day heuristic (identical days, later time) for legacy data.
 *  3. Next-day heuristic (days shifted forward one, time at or before the
 *     start — a shifted stop only exists for windows that wrap midnight).
 *  4. Unmatched disabled timers become standalone disable rules.
 *
 * A stop written for a feature rule carries the same feature (feature_value 0)
 * while a charge rule's stop is plain ('current' lives only on the start), so
 * candidates must also match on feature or they belong to another rule.
 *
 * A rule's on/off switch is the start timer's `enabled` flag (absent = on).
 * `canDisable` is true only when the firmware reports the flag at all, so the
 * switch is never offered by firmware that would ignore it.
 * @param {any[]} timers
 */
export function timersToRules(timers) {
  if (!Array.isArray(timers) || timers.length === 0) return []

  const sorted   = [...timers].sort((a, b) => a.time.localeCompare(b.time))
  // Reboot timers are one-shot triggers (no stop), so they are neither a
  // window start nor a candidate stop for another rule.
  const isReboot = (/** @type {any} */ t) => t.feature === 'reboot'
  const reboots  = sorted.filter(isReboot)
  const actives  = sorted.filter((t) => !isReboot(t) && t.state !== 'disabled')
  const disableds = sorted.filter((t) => !isReboot(t) && t.state === 'disabled')
  const usedIds  = new Set()
  const stopFor  = new Map() // active timer id → its stop timer
  const rules    = []

  const stopFeature = (/** @type {any} */ A) =>
    A.feature && A.feature !== 'current' ? A.feature : null

  const matchers = (/** @type {any} */ A) => {
    const daysKey    = daysSetKey(A.days)
    const shiftedKey = daysSetKey(shiftDaysForward(A.days ?? []))
    const feat       = stopFeature(A)
    const usable  = (/** @type {any} */ B) => !usedIds.has(B.id) && (B.feature ?? null) === feat
    const sameDay = (/** @type {any} */ B) => daysSetKey(B.days) === daysKey && B.time > A.time
    const nextDay = (/** @type {any} */ B) => daysSetKey(B.days) === shiftedKey && B.time <= A.time
    return { usable, sameDay, nextDay }
  }

  // Pass 1: resolve every id-adjacent pair first, so a time-sorted neighbour
  // can't steal a stop that provably belongs to another start.
  for (const A of actives) {
    const { usable, sameDay, nextDay } = matchers(A)
    const B = disableds.find((B) => B.id === A.id + 1 && usable(B) && (sameDay(B) || nextDay(B)))
    if (B) { stopFor.set(A.id, B); usedIds.add(B.id) }
  }
  // Passes 2/3: day-set heuristics for legacy pairs with non-adjacent ids.
  for (const A of actives) {
    if (stopFor.has(A.id)) continue
    const { usable, sameDay, nextDay } = matchers(A)
    const B = disableds.find((B) => usable(B) && sameDay(B))
           ?? disableds.find((B) => usable(B) && nextDay(B))
    if (B) { stopFor.set(A.id, B); usedIds.add(B.id) }
  }

  for (const A of actives) {
    const stop = stopFor.get(A.id) ?? null

    const action        = timerStateToAction(A.state, A.feature ?? null)
    const chargeCurrent = A.feature === 'current' ? (A.feature_value ?? null) : null
    const limit         = (A.limit && A.limit !== 'none' && A.limit_value != null)
                            ? { type: A.limit, value: A.limit_value } : null
    rules.push({
      id:            `r_${A.id}`,
      alwaysOn:      false,
      enabled:       A.enabled !== false,
      canDisable:    'enabled' in A,
      days:          A.days ?? [],
      startTime:     A.time,
      stopTime:      stop?.time ?? null,
      action,
      chargeCurrent,
      limit,
      _startEventId: A.id,
      _stopEventId:  stop?.id ?? null,
    })
  }

  for (const R of reboots) {
    rules.push({
      id:            `r_${R.id}`,
      alwaysOn:      false,
      enabled:       R.enabled !== false,
      canDisable:    'enabled' in R,
      days:          R.days ?? [],
      startTime:     R.time,
      stopTime:      null,
      action:        'reboot',
      chargeCurrent: null,
      limit:         null,
      _startEventId: R.id,
      _stopEventId:  null,
    })
  }

  // Remaining unmatched disabled timers → standalone disable rules
  for (const B of disableds) {
    if (!usedIds.has(B.id)) {
      rules.push({
        id:            `r_${B.id}`,
        alwaysOn:      false,
        enabled:       B.enabled !== false,
        canDisable:    'enabled' in B,
        days:          B.days ?? [],
        startTime:     B.time,
        stopTime:      null,
        action:        'disable',
        chargeCurrent: null,
        limit:         null,
        _startEventId: B.id,
        _stopEventId:  null,
      })
    }
  }

  return rules
}

/**
 * Given a rule (new or edited) and the current list of existing timers,
 * return `{ add: Timer[], remove: number[] }` describing what to POST/DELETE.
 *
 * For a new rule: _startEventId and _stopEventId are null — new IDs are assigned.
 * For an edited rule: existing IDs are reused.
 * @param {any} rule
 * @param {any[]} existingTimers
 */
export function rulesToTimers(rule, existingTimers) {
  // A reboot fires once at its start time: never a stop, current or limit.
  if (rule?.action === 'reboot') {
    rule = { ...rule, stopTime: null, chargeCurrent: null, limit: null }
  }
  const timers = Array.isArray(existingTimers) ? existingTimers : []
  const add = []
  const remove = []

  // Determine IDs
  let startId = rule._startEventId
  let stopId = rule._stopEventId

  const isNew = startId == null

  if (isNew) startId = nextTimerId(timers)

  // If the rule now has no stop time but previously had a stop event, delete it
  if (!isNew && rule.stopTime == null && stopId != null) {
    remove.push(stopId)
    stopId = null
  }

  // Build start timer. Both timers carry the rule's on/off flag: a disabled
  // rule drops out of the firmware's plan entirely, stop included, so the
  // rule before it stays in force (#1403). Firmware without the flag ignores it.
  const feature = actionToTimerFeature(rule.action)
  const hasLimit = rule.limit && rule.limit.type && rule.limit.type !== 'none' && rule.limit.value > 0
  const enabled = rule.enabled !== false
  const startTimer = {
    id: startId,
    time: rule.startTime,
    state: actionToTimerState(rule.action),
    days: rule.days,
    enabled,
    ...(feature
      ? { feature, feature_value: 1 }
      : rule.chargeCurrent > 0
        ? { feature: 'current', feature_value: rule.chargeCurrent }
        : {}),
    ...(hasLimit ? { limit: rule.limit.type, limit_value: rule.limit.value } : {}),
  }
  add.push(startTimer)

  // Build stop timer (if stopTime is set)
  if (rule.stopTime) {
    // No existing stop event: prefer the slot right after the start —
    // timersToRules relies on this adjacency to re-pair the events — but
    // never collide with an existing timer id (a rule gaining a stop later).
    if (stopId == null) stopId = Math.max(startId + 1, nextTimerId(timers))
    const stopDays = isNextDay(rule.startTime, rule.stopTime)
      ? shiftDaysForward(rule.days)
      : rule.days
    add.push({
      id: stopId,
      time: rule.stopTime,
      state: 'disabled',
      days: stopDays,
      enabled,
      ...(feature ? { feature, feature_value: 0 } : {}),
    })
  }

  return { add, remove }
}

/**
 * The timer writes that switch a scheduled rule on or off, in a safe order.
 *
 * Switching off writes the start first: if the stop write then fails, the
 * rule no longer starts, and a lone disabled stop does nothing. Switching on
 * writes the stop first, because the reverse would leave an enabled start
 * with a disabled stop: the rule would start and never stop, and the card
 * (which reads the flag from the start timer) would show it as on.
 * @param {any} rule
 * @param {boolean} enabled
 * @param {any[]} existingTimers
 * @returns {any[]}
 */
export function ruleEnableWrites(rule, enabled, existingTimers) {
  const { add } = rulesToTimers({ ...rule, enabled }, existingTimers)
  return enabled ? [...add].reverse() : add
}

/**
 * Whether the firmware reports the rule on/off flag on its timers.
 *
 * Firmware that has the flag (openevse_esp32_firmware#1412) is also the
 * firmware that applies an override above the default current, so this
 * doubles as that capability signal. An empty schedule gives no signal and
 * reads as false, which keeps the older, safe behaviour.
 * @param {any[]|undefined} timers
 * @returns {boolean}
 */
export function scheduleReportsEnabled(timers) {
  return Array.isArray(timers) && timers.some((t) => t && 'enabled' in t)
}

/**
 * IDs to DELETE when a rule is removed entirely.
 * @param {any} rule
 */
export function ruleDeleteIds(rule) {
  const ids = []
  if (rule._startEventId != null) ids.push(rule._startEventId)
  if (rule._stopEventId != null) ids.push(rule._stopEventId)
  return ids
}

/**
 * Stable key for comparing two days arrays as sets (order-independent).
 * @param {string[]} days
 */
function daysSetKey(days) {
  if (!Array.isArray(days)) return ''
  return [...days].sort().join(',')
}

/**
 * Format a window time string: "1:00 PM – 6:00 PM", "from 1:00 PM", or with "(next day)" suffix.
 * A point-in-time rule (Reboot Station) reads "at 3:00 AM".
 * @param {string} startTime
 * @param {string|null} stopTime
 * @param {boolean} [point]
 */
export function formatWindow(startTime, stopTime, point = false) {
  const fmt = (/** @type {string|null} */ t) => {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${period}`
  }
  if (point) return `at ${fmt(startTime)}`
  if (stopTime) {
    const nextDay = isNextDay(startTime, stopTime)
    return `${fmt(startTime)} – ${fmt(stopTime)}${nextDay ? ' (next day)' : ''}`
  }
  return `from ${fmt(startTime)}`
}
