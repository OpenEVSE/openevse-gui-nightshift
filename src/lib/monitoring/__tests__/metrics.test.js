import { describe, it, expect } from 'vitest'
import {
  round, energyMetrics, sensorMetrics, serviceMetrics, vehicleMetrics,
  showVehicle, countSeverity, safetyData, claimRows,
  homeBatteryMetrics, showHomeBattery,
} from '../metrics.js'

describe('round', () => {
  it('rounds to the given precision', () => {
    expect(round(7523.272, 1)).toBe(7523.3)
    expect(round(0, 0)).toBe(0)
  })
  it('returns null for missing / non-numeric input', () => {
    expect(round(undefined)).toBe(null)
    expect(round(null)).toBe(null)
    expect(round(false)).toBe(null)
  })
})

describe('energyMetrics', () => {
  it('converts session Wh to kWh and keeps totals in kWh', () => {
    const g = energyMetrics({ session_energy: 5000, total_energy: 7523.27, total_day: 1.234 })
    expect(g.titleKey).toBe('monitoring.group.energy')
    expect(g.rows[0]).toEqual({ labelKey: 'monitoring.energy.session', value: 5, unit: 'units.kwh' })
    expect(g.rows[1].value).toBe(7523.3)
    expect(g.rows[2].value).toBe(1.2)
  })
})

describe('sensorMetrics', () => {
  it('scales current and temperature, and includes only real temp sensors', () => {
    const g = sensorMetrics(
      { pilot: 32, amp: 16000, voltage: 240, temp: 427, temp1: 427, temp2: 266, temp3: false },
      { scale: 454, offset: 283 },
    )
    const byLabel = Object.fromEntries(g.rows.map((r) => [r.labelKey, r.value]))
    expect(byLabel['monitoring.sensor.current']).toBe(16)
    expect(byLabel['monitoring.sensor.evsetemp']).toBe(42.7)
    expect(byLabel['monitoring.sensor.temp1']).toBe(42.7)
    expect(byLabel['monitoring.sensor.temp2']).toBe(26.6)
    expect(byLabel['monitoring.sensor.temp3']).toBeUndefined() // false → omitted
    expect(byLabel['monitoring.sensor.temp4']).toBeUndefined() // missing → omitted
    expect(byLabel['monitoring.sensor.scale']).toBe(454)
  })
})

describe('serviceMetrics', () => {
  it('reads service level and current limits', () => {
    const g = serviceMetrics({ service_level: 2 }, { min_current_hard: 6, max_current_soft: 48 })
    const byLabel = Object.fromEntries(g.rows.map((r) => [r.labelKey, r.value]))
    expect(byLabel['monitoring.service.level']).toBe(2)
    expect(byLabel['monitoring.service.max']).toBe(48)
  })
})

describe('showVehicle', () => {
  it('is true only when the device reports vehicle data', () => {
    expect(showVehicle({}, {})).toBe(false)
    expect(showVehicle({ battery_level: 80 }, {})).toBe(true)
    expect(showVehicle({ battery_range: 200 }, {})).toBe(true)
    expect(showVehicle({}, { time_to_full_charge: 3600 })).toBe(true)
  })
})

describe('vehicleMetrics', () => {
  it('formats the time fields as HH:MM:SS', () => {
    const g = vehicleMetrics({ vehicle_state_update: 3661, battery_level: 80 }, {})
    const byLabel = Object.fromEntries(g.rows.map((r) => [r.labelKey, r.value]))
    expect(byLabel['monitoring.vehicle.updated']).toBe('01:01:01')
    expect(byLabel['monitoring.vehicle.battery']).toBe(80)
  })
})

describe('countSeverity', () => {
  it('maps a count against warning / alert thresholds', () => {
    expect(countSeverity(0, 20000, 40000)).toBe('ok')
    expect(countSeverity(20000, 20000, 40000)).toBe('ok')
    expect(countSeverity(20001, 20000, 40000)).toBe('warning')
    expect(countSeverity(40001, 20000, 40000)).toBe('error')
  })
})

describe('safetyData', () => {
  it('builds error rows; counts are ok at 0, error otherwise', () => {
    const d = safetyData({ gfcicount: 0, nogndcount: 5, stuckcount: 0, total_switches: 19 }, false)
    expect(d.errors).toHaveLength(3) // no fault row
    expect(d.errors.find((r) => r.key === 'gfci').severity).toBe('ok')
    expect(d.errors.find((r) => r.key === 'noground').severity).toBe('error')
    expect(d.infos[0]).toMatchObject({ key: 'switches', count: 19, severity: 'ok' })
  })
  it('prepends a fault row carrying the state code when faulted', () => {
    const d = safetyData({ state: 8, gfcicount: 0, nogndcount: 0, stuckcount: 0 }, true)
    expect(d.errors[0]).toEqual({ key: 'fault', state: 8, severity: 'error' })
  })
})

describe('vehicleMetrics extras', () => {
  const byLabel = (g) => Object.fromEntries(g.rows.map((r) => [r.labelKey, r]))

  it('omits the charging row when absent', () => {
    const m = byLabel(vehicleMetrics({ battery_level: 80 }, {}))
    expect(m['monitoring.vehicle.charging_state']).toBeUndefined()
  })
  it('derives "charging" from EVSE state 3', () => {
    expect(byLabel(vehicleMetrics({ state: 3 }, {}))['monitoring.vehicle.charging_state'])
      .toEqual({ labelKey: 'monitoring.vehicle.charging_state', textKey: 'monitoring.vehicle.charging_active', unit: '' })
  })
  it('derives "idle" from EVSE state 2 (connected, not charging)', () => {
    expect(byLabel(vehicleMetrics({ state: 2 }, {}))['monitoring.vehicle.charging_state'].textKey)
      .toBe('monitoring.vehicle.charging_idle')
  })
  it('omits the charging row for non-connected / fault / disabled states', () => {
    for (const state of [1, 8, 254, 255, undefined]) {
      expect(byLabel(vehicleMetrics({ state }, {}))['monitoring.vehicle.charging_state']).toBeUndefined()
    }
  })
  it('ignores the legacy vehicle_charging_state push field', () => {
    expect(byLabel(vehicleMetrics({ vehicle_charging_state: 'Charging' }, {}))['monitoring.vehicle.charging_state'])
      .toBeUndefined()
  })
})

describe('homeBatteryMetrics / showHomeBattery', () => {
  it('builds soc and power rows', () => {
    const g = homeBatteryMetrics({ home_battery_soc: 82.4, home_battery_power: -1200 })
    expect(g.titleKey).toBe('monitoring.group.home_battery')
    const byLabel = Object.fromEntries(g.rows.map((r) => [r.labelKey, r]))
    expect(byLabel['monitoring.home_battery.soc']).toEqual({ labelKey: 'monitoring.home_battery.soc', value: 82, unit: 'units.percent' })
    expect(byLabel['monitoring.home_battery.power']).toEqual({ labelKey: 'monitoring.home_battery.power', value: -1200, unit: 'units.watt' })
  })
  it('shows only when home_battery_soc is a real number', () => {
    expect(showHomeBattery({ home_battery_soc: 0 })).toBe(true)
    expect(showHomeBattery({ home_battery_soc: 82 })).toBe(true)
    expect(showHomeBattery({})).toBe(false)
    expect(showHomeBattery({ home_battery_soc: null })).toBe(false)
    expect(showHomeBattery({ home_battery_soc: false })).toBe(false)
  })
})

describe('claimRows', () => {
  it('maps each claim key to property / clientId / value', () => {
    const rows = claimRows({
      claims: { state: 65537, charge_current: 65538 },
      properties: { state: 'disabled', charge_current: 32 },
    })
    expect(rows).toEqual([
      { property: 'state', clientId: 65537, value: 'disabled' },
      { property: 'charge_current', clientId: 65538, value: 32 },
    ])
  })
  it('returns an empty array for missing input', () => {
    expect(claimRows(undefined)).toEqual([])
    expect(claimRows({})).toEqual([])
  })
})
