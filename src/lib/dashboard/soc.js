/** Pure helpers for the Vehicle SOC bar. No store or DOM access — fully unit-tested. */

/** Clamp a value to 0..100; non-finite becomes 0. */
function clampPct(n) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

/** Resting knob position when no soc limit is set: the vehicle limit, or 80 if unknown. */
export function restingTarget(vehicleLimit) {
  return Number.isFinite(vehicleLimit) ? clampPct(vehicleLimit) : 80
}

/** True when the target sits above the vehicle's own limit (a hard ceiling). */
export function isCapped(target, vehicleLimit) {
  return Number.isFinite(vehicleLimit) && target > vehicleLimit
}

/** Where charging actually stops: min(target, vehicleLimit) when the limit is known. */
export function effectiveStop(target, vehicleLimit) {
  return Number.isFinite(vehicleLimit) ? Math.min(target, vehicleLimit) : target
}

/**
 * Bar geometry as 0..100 percentages.
 *  fillPct       solid SOC fill
 *  zoneEndPct    end of the lighter "will charge to" zone (= effective stop, never below SOC)
 *  hatchStartPct unreachable-region start (vehicle limit) — only meaningful when capped
 *  hatchEndPct   unreachable-region end (target) — only meaningful when capped
 */
export function socBarSegments({ soc, target, vehicleLimit }) {
  const s = clampPct(soc)
  const t = clampPct(target)
  const eff = clampPct(effectiveStop(t, vehicleLimit))
  return {
    fillPct: s,
    zoneEndPct: Math.max(s, eff),
    hatchStartPct: clampPct(vehicleLimit),
    hatchEndPct: t,
  }
}

/** Short H/M duration: 4500 -> "1h 15m", 600 -> "10m", 0/invalid -> "". */
export function hmsShort(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return ''
  let h = Math.floor(sec / 3600)
  let m = Math.round((sec % 3600) / 60)
  if (m === 60) {
    h += 1
    m = 0
  }
  return h ? `${h}h ${m}m` : `${m}m`
}
