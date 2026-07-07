/**
 * src/lib/config/remoteDisplay.js
 *
 * A "remote display" build (openevse_remote_display in the firmware repo) is a
 * standalone LVGL panel that mirrors another OpenEVSE station over HTTP. The
 * firmware signals the capability by including the remote_display_host option
 * in /config (same capability-signal pattern as tft_theme for the TFT panel).
 *
 * Remote displays get a reduced, permanent setup wizard: there is no charger
 * on the serial port, so none of the charger pages apply.
 */
export function isRemoteDisplay(config) {
  return typeof config?.remote_display_host === 'string'
}
