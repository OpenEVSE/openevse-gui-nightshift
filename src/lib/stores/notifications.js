import { writable } from 'svelte/store'
import { httpAPI } from '../api/httpAPI.js'
import { normalizeNotifications } from '../notifications/notifications.js'

// Advisory list. Seeded and refreshed from GET /notifications only — the
// websocket carries the two badge fields and nothing else, so there is no
// per-item push to merge. DataManager owns the "when": it re-downloads
// whenever /status moves `count` or `severity`.
//
// The model matches normalizeNotifications(): `count`/`severity` are the
// unmuted badge figures, `items` is everything including muted entries.
const model = { count: 0, severity: 'info', items: [] }

function createNotificationStore() {
  const P = writable(model)
  const { subscribe, set, update } = P

  async function download() {
    const res = await httpAPI('GET', '/notifications')
    // Firmware without the advisory engine has no such route, so the SPA index
    // comes back and httpAPI's response.json() throws → 'error'. DataManager's
    // capability gate means such a build never reaches this call at all; the
    // check is here so a transient failure leaves the last good list standing
    // rather than blanking the panel.
    if (!res || res === 'error' || typeof res !== 'object') return false
    P.set(normalizeNotifications(res))
    return true
  }

  async function ack(id) {
    if (!id) return false
    // Form-encoded body rather than a query string: ArduinoMongoose's
    // getParam() reads the query string only on a GET and the body on
    // everything else. The firmware accepts both, but the body is the form it
    // finds first. The reply is text/plain ("acknowledged" / "id required" /
    // "no such active notification"), never JSON.
    const res = await httpAPI(
      'POST',
      '/notifications/ack',
      'id=' + encodeURIComponent(id),
      'text',
    )
    const ok = typeof res === 'string' && res.includes('acknowledged')
    // Re-read whatever the answer was. An ack changes `acked` and `count` but
    // not the live *set*, and the firmware only pushes on a set change — so
    // nothing would arrive over the websocket to correct the badge. A 404
    // ("no such active notification") means the advisory cleared between
    // render and tap, which the same re-read reconciles.
    await download()
    return ok
  }

  function reset() {
    P.set(model)
    return true
  }

  return { subscribe, set, update, download, ack, reset }
}

export const notification_store = createNotificationStore()
