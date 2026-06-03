/** Pure helpers for the Monitoring screen. Self-contained — no store/DOM imports. */
import { formatTemp } from '../temperature.js'

/** HA vehicle charging-state strings → localized label keys. Unknown values pass through. */
const CHARGING_STATE_KEYS = {
  charging: 'monitoring.vehicle.charging_active',
  complete: 'monitoring.vehicle.charging_complete',
  charged: 'monitoring.vehicle.charging_complete',
  full: 'monitoring.vehicle.charging_complete',
  idle: 'monitoring.vehicle.charging_idle',
  stopped: 'monitoring.vehicle.charging_idle',
  disconnected: 'monitoring.vehicle.charging_idle',
}

/** Interpret an HA plugged-in value (bool, 0/1, or "on"/"off"/"true"/"false") as a boolean. */
function isPlugged(v) {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return ['true', 'on', '1', 'yes'].includes(v.trim().toLowerCase())
  return false
}

/** Round `value` to `p` decimals; null for missing / non-numeric input. */
export function round(value, p = 0) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const m = Math.pow(10, p)
  return Math.round(n * m) / m
}

/** Format a duration in seconds as HH:MM:SS. */
function hms(sec) {
  const s = Number(sec)
  if (!Number.isFinite(s) || s < 0) return '00:00:00'
  const pad = (n) => String(Math.floor(n)).padStart(2, '0')
  return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`
}

/** Tenths-of-°C → °C (1 dp); null when the sensor reports no real number. */
function tempC(raw) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  return round(raw / 10, 1)
}

export function energyMetrics(status) {
  const s = status ?? {}
  return {
    titleKey: 'monitoring.group.energy',
    rows: [
      { labelKey: 'monitoring.energy.session', value: round((s.session_energy ?? 0) / 1000, 1), unit: 'units.kwh' },
      { labelKey: 'monitoring.energy.total', value: round(s.total_energy, 1), unit: 'units.kwh' },
      { labelKey: 'monitoring.energy.day', value: round(s.total_day, 1), unit: 'units.kwh' },
      { labelKey: 'monitoring.energy.week', value: round(s.total_week, 1), unit: 'units.kwh' },
      { labelKey: 'monitoring.energy.month', value: round(s.total_month, 1), unit: 'units.kwh' },
      { labelKey: 'monitoring.energy.year', value: round(s.total_year, 1), unit: 'units.kwh' },
    ],
  }
}

export function sensorMetrics(status, config, { tempUnit = 'c' } = {}) {
  const s = status ?? {}
  const c = config ?? {}
  const evseT = formatTemp(tempC(s.temp), tempUnit)
  const rows = [
    { labelKey: 'monitoring.sensor.pilot', value: round(s.pilot, 0), unit: 'units.amp' },
    { labelKey: 'monitoring.sensor.current', value: round((s.amp ?? 0) / 1000, 1), unit: 'units.amp' },
    { labelKey: 'monitoring.sensor.voltage', value: round(s.voltage, 0), unit: 'units.volt' },
    { labelKey: 'monitoring.sensor.evsetemp', value: evseT.value, unit: evseT.unitKey },
  ]
  ;[s.temp1, s.temp2, s.temp3, s.temp4].forEach((raw, i) => {
    const v = tempC(raw)
    if (v === null) return
    const t = formatTemp(v, tempUnit)
    rows.push({ labelKey: `monitoring.sensor.temp${i + 1}`, value: t.value, unit: t.unitKey })
  })
  rows.push({ labelKey: 'monitoring.sensor.scale', value: c.scale ?? null, unit: '' })
  rows.push({ labelKey: 'monitoring.sensor.offset', value: c.offset ?? null, unit: '' })
  return { titleKey: 'monitoring.group.sensors', rows }
}

export function serviceMetrics(status, config) {
  const s = status ?? {}
  const c = config ?? {}
  return {
    titleKey: 'monitoring.group.service',
    rows: [
      { labelKey: 'monitoring.service.level', value: s.service_level ?? null, unit: '' },
      { labelKey: 'monitoring.service.min', value: c.min_current_hard ?? null, unit: 'units.amp' },
      { labelKey: 'monitoring.service.max', value: c.max_current_soft ?? null, unit: 'units.amp' },
    ],
  }
}

export function vehicleMetrics(status, config) {
  const s = status ?? {}
  const c = config ?? {}
  const rows = [
    { labelKey: 'monitoring.vehicle.updated', value: hms(s.vehicle_state_update), unit: '' },
    { labelKey: 'monitoring.vehicle.battery', value: s.battery_level ?? null, unit: 'units.percent' },
    { labelKey: 'monitoring.vehicle.range', value: s.battery_range ?? null, unit: c.mqtt_vehicle_range_miles ? 'units.miles' : 'units.km' },
    { labelKey: 'monitoring.vehicle.timeleft', value: hms(s.time_to_full_charge), unit: '' },
  ]
  if (s.vehicle_plugged !== undefined && s.vehicle_plugged !== null) {
    rows.push({
      labelKey: 'monitoring.vehicle.plugged',
      textKey: isPlugged(s.vehicle_plugged) ? 'monitoring.vehicle.plugged_yes' : 'monitoring.vehicle.plugged_no',
      unit: '',
    })
  }
  if (typeof s.vehicle_charging_state === 'string' && s.vehicle_charging_state.trim() !== '') {
    const key = CHARGING_STATE_KEYS[s.vehicle_charging_state.trim().toLowerCase()]
    rows.push(key
      ? { labelKey: 'monitoring.vehicle.charging_state', textKey: key, unit: '' }
      : { labelKey: 'monitoring.vehicle.charging_state', value: s.vehicle_charging_state, unit: '' })
  }
  return { titleKey: 'monitoring.group.vehicle', rows }
}

/** Whether the Vehicle metric group should render. */
export function showVehicle(status, config) {
  const s = status ?? {}
  const c = config ?? {}
  return s.battery_level !== undefined || s.battery_range !== undefined || !!c.time_to_full_charge
}

export function homeBatteryMetrics(status) {
  const s = status ?? {}
  return {
    titleKey: 'monitoring.group.home_battery',
    rows: [
      { labelKey: 'monitoring.home_battery.soc', value: round(s.home_battery_soc, 0), unit: 'units.percent' },
      { labelKey: 'monitoring.home_battery.power', value: round(s.home_battery_power, 0), unit: 'units.watt' },
    ],
  }
}

/** Whether the Home Battery group should render. */
export function showHomeBattery(status) {
  return round((status ?? {}).home_battery_soc, 0) !== null
}

/** 'ok' | 'warning' | 'error' for a count against warning / alert thresholds. */
export function countSeverity(count, warning, alert) {
  const n = Number(count)
  if (!Number.isFinite(n)) return 'ok'
  if (n > alert) return 'error'
  if (n > warning) return 'warning'
  return 'ok'
}

/** Build the Safety-tab rows. The fault row carries `state` for getStateDesc. */
export function safetyData(status, hasError) {
  const s = status ?? {}
  const countRow = (key, count) => ({
    key,
    count: count ?? 0,
    severity: (count ?? 0) === 0 ? 'ok' : 'error',
  })
  const errors = []
  if (hasError) errors.push({ key: 'fault', state: s.state, severity: 'error' })
  errors.push(countRow('gfci', s.gfcicount))
  errors.push(countRow('noground', s.nogndcount))
  errors.push(countRow('stuck', s.stuckcount))
  const switches = s.total_switches ?? 0
  const infos = [{ key: 'switches', count: switches, severity: countSeverity(switches, 20000, 40000) }]
  return { errors, infos }
}

/** One row per entry in `claims_target.claims`. */
export function claimRows(claimsTarget) {
  const ct = claimsTarget ?? {}
  const claims = ct.claims ?? {}
  const properties = ct.properties ?? {}
  return Object.keys(claims).map((property) => ({
    property,
    clientId: claims[property],
    value: properties[property],
  }))
}
