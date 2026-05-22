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
