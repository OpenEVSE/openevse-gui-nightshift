// Relative-time / duration formatting helpers.
//
// Pure functions extracted from the MQTT and Time settings pages so the edge
// cases (0s, sub-minute, multi-hour, null) can be unit-tested. `now` is passed
// in explicitly to keep these deterministic.

/**
 * Format a non-negative duration (in seconds) as a compact label:
 *   < 60s   -> "Ns"
 *   < 1h    -> "Mm Ss"
 *   >= 1h   -> "Hh Mm"
 * Negative inputs are clamped to 0.
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

/**
 * Relative "… ago" label for a unix timestamp (seconds).
 * Returns null when the timestamp is falsy (0 / null / undefined) so callers can
 * render a "Never" placeholder.
 * @param {number} unixTs   seconds since epoch
 * @param {number} [nowMs]  current time in ms (defaults to Date.now())
 * @returns {string|null}
 */
export function formatAgo(unixTs, nowMs = Date.now()) {
  if (!unixTs) return null
  const s = Math.max(0, Math.floor(nowMs / 1000) - unixTs)
  return `${formatDuration(s)} ago`
}

/**
 * Countdown label from milliseconds remaining.
 * Returns "—" when the input is null/undefined or already elapsed.
 * @param {number|null|undefined} ms
 * @returns {string}
 */
export function formatCountdown(ms) {
  if (ms == null) return '—'
  const s = Math.ceil(ms / 1000)
  if (s <= 0) return '—'
  return formatDuration(s)
}
