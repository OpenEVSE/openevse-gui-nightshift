import { describe, it, expect } from 'vitest'
import {
	vehicleLimitAvailability,
	VEHICLE_SRC_NONE,
	VEHICLE_SRC_TESLA,
	VEHICLE_SRC_MQTT,
	VEHICLE_SRC_HTTP,
	VEHICLE_SRC_HOME_ASSISTANT,
} from '../vehicle.js'

describe('vehicleLimitAvailability', () => {
	it('offers nothing when no source is configured and nothing is reporting', () => {
		expect(vehicleLimitAvailability({ vehicle_data_src: VEHICLE_SRC_NONE }, {})).toEqual({
			soc: false,
			range: false,
		})
	})

	// The regression this function exists for: every non-MQTT source leaves the
	// mqtt_vehicle_* keys empty, which used to disable SOC and range outright.
	it.each([
		['HTTP push', VEHICLE_SRC_HTTP],
		['Tesla', VEHICLE_SRC_TESLA],
		['Home Assistant', VEHICLE_SRC_HOME_ASSISTANT],
		['MQTT', VEHICLE_SRC_MQTT],
	])('offers both for %s even with no MQTT topics set', (_name, src) => {
		const config = { vehicle_data_src: src, mqtt_vehicle_soc: '', mqtt_vehicle_range: '' }
		expect(vehicleLimitAvailability(config, {})).toEqual({ soc: true, range: true })
	})

	it('offers a limit on live data even when no source is configured', () => {
		const config = { vehicle_data_src: VEHICLE_SRC_NONE }
		expect(vehicleLimitAvailability(config, { battery_level: 76 })).toEqual({
			soc: true,
			range: false,
		})
		expect(vehicleLimitAvailability(config, { battery_range: 234 })).toEqual({
			soc: false,
			range: true,
		})
	})

	it('treats a zero reading as present, not missing', () => {
		const config = { vehicle_data_src: VEHICLE_SRC_NONE }
		expect(vehicleLimitAvailability(config, { battery_level: 0, battery_range: 0 })).toEqual({
			soc: true,
			range: true,
		})
	})

	it('survives absent config and status', () => {
		expect(vehicleLimitAvailability(null, null)).toEqual({ soc: false, range: false })
		expect(vehicleLimitAvailability(undefined, undefined)).toEqual({ soc: false, range: false })
	})
})
