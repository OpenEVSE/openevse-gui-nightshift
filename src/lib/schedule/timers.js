/** Pure helpers for the Schedule screen. No store or DOM access — fully unit-tested. */

/** The seven weekdays in the device's order (Monday-first). Single source of truth. */
export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

/** Next free timer id: highest existing id + 1, or 1 when the list is empty. */
export function nextTimerId(timers) {
  if (!Array.isArray(timers) || timers.length === 0) return 1
  let max = 0
  for (const t of timers) {
    const id = Number(t?.id)
    if (Number.isFinite(id) && id > max) max = id
  }
  return max + 1
}

/** A `days` name array → a Monday-first boolean[7]. */
export function daysToFlags(days) {
  const set = new Set(Array.isArray(days) ? days : [])
  return DAYS.map((d) => set.has(d))
}

/** A Monday-first boolean[7] → a `days` name array. */
export function flagsToDays(flags) {
  const f = Array.isArray(flags) ? flags : []
  return DAYS.filter((_, i) => f[i] === true)
}

/** True when at least one day flag is set (the save-validation rule). */
export function hasAnyDay(flags) {
  return Array.isArray(flags) && flags.some((x) => x === true)
}

/** All seven days as `{ day, on }`, in order, for the TimerRow chip strip. */
export function formatDayChips(days) {
  const set = new Set(Array.isArray(days) ? days : [])
  return DAYS.map((d) => ({ day: d, on: set.has(d) }))
}
