// Shared safety-check helpers so the Charge Manager and the Safety settings
// page agree on what "All Required Safety Checks On" means.
//
// GFCI self-test and overcurrent monitoring are *optional* safety features —
// they're shown as toggles but don't gate the all-required-on status.

/** Checks that must all be on for the all-required-on status. */
export const REQUIRED_SAFETY_CHECKS = ['ground_check', 'relay_check', 'diode_check', 'vent_check']

/** True when every required safety check is enabled in the config object. */
export function allRequiredSafetyChecksOn(config) {
  const c = config ?? {}
  return REQUIRED_SAFETY_CHECKS.every((k) => !!c[k])
}
