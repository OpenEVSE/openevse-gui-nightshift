// Which vehicle-telemetry limits the rule editor should offer.
//
// This deliberately does not require a live reading. Rules are authored ahead
// of time, usually with the car unplugged and nothing reporting, so gating on
// current data would hide the limit at exactly the moment it is being set up.
// A configured source is enough; a rule whose data never arrives simply does
// not fire, which is the same outcome as an unplugged car.

// vehicle_data_src values, matching the firmware's enum in app_config.h.
export const VEHICLE_SRC_NONE = 0
export const VEHICLE_SRC_TESLA = 1
export const VEHICLE_SRC_MQTT = 2
export const VEHICLE_SRC_HTTP = 3
export const VEHICLE_SRC_HOME_ASSISTANT = 4

/**
 * @param {object|null|undefined} config  /config document
 * @param {object|null|undefined} status  /status document
 * @returns {{soc: boolean, range: boolean}}
 */
export function vehicleLimitAvailability(config, status) {
	// Any source but "none" means telemetry is expected from somewhere. Testing
	// the MQTT topic keys instead (the original behaviour) left SOC and range
	// permanently unavailable for HTTP push, Tesla and Home Assistant, none of
	// which populate those keys.
	const sourceConfigured = Number(config?.vehicle_data_src ?? VEHICLE_SRC_NONE) !== VEHICLE_SRC_NONE

	return {
		soc: status?.battery_level != null || sourceConfigured,
		range: status?.battery_range != null || sourceConfigured,
	}
}
