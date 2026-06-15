/** Pure helpers for the Charge Manager. No store or DOM access — fully unit-tested. */

import { DAYS, nextTimerId, daysToFlags, flagsToDays } from '../schedule/timers.js'

export { DAYS, daysToFlags, flagsToDays }

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
  if (action === 'disable') return 'disabled'
  return 'active'
}

/**
 * Maps a Rule action to the firmware `feature` field value.
 * 'eco' is treated as an alias for 'eco_divert' because the firmware has no
 * native Eco EvseState — divert's eco mode is the correct implementation.
 * @param {string} action
 * @returns {string|null}
 */
export function actionToTimerFeature(action) {
  /** @type {Record<string,string>} */
  const map = { eco: 'divert', eco_divert: 'divert', shaper: 'shaper', rfid: 'rfid', ocpp: 'ocpp' }
  return map[action] ?? null
}

/**
 * Maps a timer `state` + optional `feature` back to a Rule action.
 * `state === 'eco'` handles old-format timers stored before this format change.
 * @param {string} state
 * @param {string|null} [feature]
 */
export function timerStateToAction(state, feature = null) {
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
 * Two-phase pairing:
 *  1. For each non-disabled (start) timer A, prefer a same-day stop
 *     (disabled, same days, later time).  If none, accept a next-day stop
 *     (disabled timer whose days set equals shiftDaysForward(A.days)).
 *  2. Unmatched disabled timers become standalone disable rules.
 *
 * Processing actives before disableds means a disabled that appears earlier
 * in time-sorted order can still be matched as a next-day stop.
 * @param {any[]} timers
 */
export function timersToRules(timers) {
  if (!Array.isArray(timers) || timers.length === 0) return []

  const sorted   = [...timers].sort((a, b) => a.time.localeCompare(b.time))
  const actives  = sorted.filter((t) => t.state !== 'disabled')
  const disableds = sorted.filter((t) => t.state === 'disabled')
  const usedIds  = new Set()
  const rules    = []

  for (const A of actives) {
    const daysKey    = daysSetKey(A.days)
    const shiftedKey = daysSetKey(shiftDaysForward(A.days ?? []))

    // Pass 1: same-day stop (later time on identical days)
    let stop = null
    for (const B of disableds) {
      if (usedIds.has(B.id)) continue
      if (daysSetKey(B.days) === daysKey && B.time > A.time) { stop = B; break }
    }
    // Pass 2: next-day stop (shifted days, any time)
    if (!stop) {
      for (const B of disableds) {
        if (usedIds.has(B.id)) continue
        if (daysSetKey(B.days) === shiftedKey) { stop = B; break }
      }
    }
    if (stop) usedIds.add(stop.id)

    const action        = timerStateToAction(A.state, A.feature ?? null)
    const chargeCurrent = A.feature === 'current' ? (A.feature_value ?? null) : null
    const limit         = (A.limit && A.limit !== 'none' && A.limit_value != null)
                            ? { type: A.limit, value: A.limit_value } : null
    rules.push({
      id:            `r_${A.id}`,
      alwaysOn:      false,
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

  // Remaining unmatched disabled timers → standalone disable rules
  for (const B of disableds) {
    if (!usedIds.has(B.id)) {
      rules.push({
        id:            `r_${B.id}`,
        alwaysOn:      false,
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
  const timers = Array.isArray(existingTimers) ? existingTimers : []
  const add = []
  const remove = []

  // Determine IDs
  let startId = rule._startEventId
  let stopId = rule._stopEventId

  const isNew = startId == null

  if (isNew) {
    startId = nextTimerId(timers)
    stopId = startId + 1
  }

  // If the rule now has no stop time but previously had a stop event, delete it
  if (!isNew && rule.stopTime == null && stopId != null) {
    remove.push(stopId)
    stopId = null
  }

  // Build start timer
  const feature = actionToTimerFeature(rule.action)
  const hasLimit = rule.limit && rule.limit.type && rule.limit.type !== 'none' && rule.limit.value > 0
  const startTimer = {
    id: startId,
    time: rule.startTime,
    state: actionToTimerState(rule.action),
    days: rule.days,
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
    // If new and we need a fresh stop ID, ensure it doesn't clash
    if (isNew || stopId == null) {
      const allIds = [...timers.map((t) => t.id), startId]
      stopId = Math.max(...allIds) + 1
    }
    const stopDays = isNextDay(rule.startTime, rule.stopTime)
      ? shiftDaysForward(rule.days)
      : rule.days
    add.push({
      id: stopId,
      time: rule.stopTime,
      state: 'disabled',
      days: stopDays,
      ...(feature ? { feature, feature_value: 0 } : {}),
    })
  }

  return { add, remove }
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
 * @param {string} startTime
 * @param {string|null} stopTime
 */
export function formatWindow(startTime, stopTime) {
  const fmt = (/** @type {string|null} */ t) => {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${period}`
  }
  if (stopTime) {
    const nextDay = isNextDay(startTime, stopTime)
    return `${fmt(startTime)} – ${fmt(stopTime)}${nextDay ? ' (next day)' : ''}`
  }
  return `from ${fmt(startTime)}`
}
