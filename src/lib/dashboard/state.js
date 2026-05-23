/** Pure helpers for the Dashboard. No store or DOM access — fully unit-tested. */

/**
 * Map the raw OpenEVSE `state` code to a Dashboard display state.
 *
 * `mode` is the dashboard's derived mode (0 = Auto, 1 = On, 2 = Off).
 * Picking Off only drops charge_current to 0 — the device then sits in
 * the same state 254 it would be in if Auto were waiting on a timer.
 * So we use mode to disambiguate: 254 + Off = 'off'; 254 + anything else
 * = 'sleeping'.
 */
export function displayState(status, mode = 0) {
  const s = status?.state
  if (s === undefined || s === null || s === 0) return 'starting'
  if (s === 1) return 'idle'
  if (s === 3) return 'charging'
  if (s >= 4 && s <= 11) return 'error'
  if (s === 254) return mode === 2 ? 'off' : 'sleeping'
  if (s === 255) return 'off'      // device was already disabled at boot
  return 'connected'               // 2: car plugged in, not charging
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

/** Progress (0..1) toward an active charge limit. */
export function limitProgress(limit, status) {
  if (!limit || limit.type === 'none' || !limit.value) return 0
  if (limit.type === 'time') {
    const targetSeconds = limit.value * 60
    return clamp01((status?.session_elapsed ?? 0) / targetSeconds)
  }
  if (limit.type === 'energy') {
    return clamp01((status?.session_energy ?? 0) / limit.value)
  }
  return 0
}

/** Ring fill (0..1): limit progress when a limit is active, else power vs max power. */
export function ringFill(status, config, limit) {
  if (limit && limit.type && limit.type !== 'none' && limit.value) {
    return limitProgress(limit, status)
  }
  const maxPower = (config?.max_current_soft ?? 0) * (status?.voltage ?? 0)
  if (maxPower <= 0) return 0
  return clamp01((status?.power ?? 0) / maxPower)
}

/**
 * Why the EVSE is connected-but-not-charging.
 * mode: 0 Auto, 1 On, 2 Off. Returns an i18n key + interpolation values.
 */
export function connectedReason(mode, plan) {
  const next = plan?.next_event
  if (next && next.time) {
    return { key: 'dashboard.reason.waiting', values: { time: next.time } }
  }
  if (mode === 2) return { key: 'dashboard.reason.off', values: {} }
  return { key: 'dashboard.reason.not_charging', values: {} }
}
