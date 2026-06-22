import { writable } from 'svelte/store'
import { httpAPI } from '../api/httpAPI.js'

// GET /claims → array of active EVSE claims, each with its *actual* runtime
// priority (e.g. shaper claims at 1100 while timer-controlled, 5000 otherwise).
// /claims/target only maps property→winning client, so this is the source for
// the real per-client priority shown in the Claims Manager.
function createClaimsStore() {
  const P = writable([])
  const { subscribe, set, update } = P

  async function download() {
    const res = await httpAPI('GET', '/claims')
    if (Array.isArray(res)) {
      set(res)
      return true
    }
    if (res && res.msg !== 'error' && res !== 'error') {
      // Some firmware wraps it; accept an object with a claims array too.
      set(Array.isArray(res.claims) ? res.claims : [])
      return true
    }
    return false
  }

  return { subscribe, set, update, download }
}

export const claims_store = createClaimsStore()
