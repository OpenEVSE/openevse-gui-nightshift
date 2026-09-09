// src/lib/cloud/cloud.js
// Pure logic for the charger's cloud connection — a second, independent MQTT
// client in the firmware that carries one telemetry contract to a managed
// broker. The GUI never talks to that broker: everything here is derived from
// the charger's own GET /status and GET /config.
//
// Route components stay thin, so capability detection, the local-publisher
// hold-down mapping, identity validation and the run-state derivation all live
// here with unit tests.

// ── Capability ──────────────────────────────────────────────────────────────

/**
 * Whether this firmware build has the cloud client at all.
 *
 * Only a build compiled with the client serialises the cloud_* keys into
 * GET /config, so the *presence* of `cloud_enabled` is the probe — never its
 * value: a claimed charger with the connection switched off is exactly when
 * the owner needs the page to turn it back on. It is also never `cloud_thing`
 * on /status, which every build emits (the no-client stub returns "") and
 * which stays empty until the client first attempts a connection.
 */
export function hasCloudClient(config) {
  return !!config && typeof config === 'object' && 'cloud_enabled' in config
}

// ── The local MQTT publisher's hold-down reason ─────────────────────────────

// GET /status carries `local_mqtt_disabled_reason`, the firmware's own string.
// "" and "not_configured" are ordinary states the MQTT page already renders;
// these two mean the publisher is being held down deliberately and will not
// come up, so the page must say so instead of waiting for a connection.
export const LOCAL_MQTT_HOLD_REASONS = ['one_connection', 'low_heap']

export function localMqttHeldDown(reason) {
  return LOCAL_MQTT_HOLD_REASONS.includes(reason)
}

/** i18n key explaining the hold-down, or null when the publisher is free. */
export function localMqttNoticeKey(reason) {
  return localMqttHeldDown(reason) ? 'config.mqtt.held_' + reason : null
}

// ── Identity ────────────────────────────────────────────────────────────────

// The thing name is the IoT thing, the MQTT client id and a segment of the
// topic root at once, which is why the firmware refuses anything that is not
// `evse-` plus twelve lowercase hex digits before it even opens a socket. The
// GUI validates the same shape and never derives a name of its own.
export const THING_PATTERN = /^evse-[0-9a-f]{12}$/

export function isThingName(v) {
  const ok = typeof v === 'string' && THING_PATTERN.test(v)
  return { ok, msgKey: ok ? null : 'config.validation.cloud_thing' }
}

/**
 * What to show for the charger's cloud identity, given the configured
 * `cloud_thing` and the one reported live on /status.
 *
 * The firmware only fills the reported name inside its connection attempt, so
 * an unclaimed charger — and one with the connection switched off — reports "".
 * That is "not claimed yet", not an error. A configured name that never turns
 * into a reported one is the interesting case: either it is malformed (the
 * firmware refuses it outright) or the client has not attempted a connection.
 *
 * @returns {{ value: string, state: 'active'|'invalid'|'pending'|'unclaimed' }}
 */
export function identityState(config, reportedThing) {
  const reported = typeof reportedThing === 'string' ? reportedThing : ''
  if (reported) return { value: reported, state: 'active' }

  const configured = String(config?.cloud_thing ?? '')
  if (!configured) return { value: '', state: 'unclaimed' }
  return { value: configured, state: isThingName(configured).ok ? 'pending' : 'invalid' }
}

// ── Run state ───────────────────────────────────────────────────────────────

/**
 * Whether the firmware will even try to connect, mirroring the gate in
 * CloudClient::loop(): enabled, a server, and a non-zero agent interval.
 * 'running' means "allowed to connect", not "connected".
 *
 * @returns {'unsupported'|'disabled'|'unclaimed'|'interval_zero'|'running'}
 */
export function cloudRunState(config) {
  if (!hasCloudClient(config)) return 'unsupported'
  if (!config.cloud_enabled) return 'disabled'
  if (!String(config.cloud_server ?? '').trim()) return 'unclaimed'
  if (!(Number(config.cloud_agent_interval) > 0)) return 'interval_zero'
  return 'running'
}

/**
 * The connection status to display: the run state when the client is held
 * back, otherwise whether it is actually up.
 *
 * @returns {'unsupported'|'disabled'|'unclaimed'|'interval_zero'|'connected'|'disconnected'}
 */
export function cloudStatus(config, connected) {
  const run = cloudRunState(config)
  if (run !== 'running') return run
  return connected ? 'connected' : 'disconnected'
}

// ── Dropped-command counter ─────────────────────────────────────────────────

/**
 * Inbound payloads the firmware dropped because its three-slot queue was full.
 *
 * `cloud_dropped` is omitted from /status when it is zero and the WebSocket
 * merge is a shallow spread, so a value seen once sticks in status_store until
 * the page is reloaded. A freshly fetched /status is therefore authoritative:
 * if the key is absent from it, the counter really is zero.
 */
export function droppedCount(freshStatus, storeStatus) {
  const source = freshStatus && typeof freshStatus === 'object' ? freshStatus : storeStatus
  const n = Number(source?.cloud_dropped ?? 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}
