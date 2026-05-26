import { writable } from 'svelte/store'
import { httpAPI } from '../api/httpAPI.js'
import { serialQueue } from '../queue.js'

// Holds the firmware's UID → user-name map. Backed by /rfid/users on devices
// that support it; we treat any non-object response (404, HTML error, etc.)
// as "feature unavailable" and surface that via the error flag rather than
// crashing the page.
function emptyState() {
  return { users: {}, loading: false, error: false }
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function createRfidUsersStore() {
  const P = writable(emptyState())
  const { subscribe, set, update } = P

  async function download() {
    update((s) => ({ ...s, loading: true, error: false }))
    const res = await serialQueue.add(() => httpAPI('GET', '/rfid/users'))
    if (!res || res === 'error' || res.msg === 'error' || !isPlainObject(res)) {
      update((s) => ({ ...s, loading: false, error: true }))
      return false
    }
    set({ users: res, loading: false, error: false })
    return true
  }

  async function save(uid, name) {
    const body = JSON.stringify({ rfid: uid, name })
    const res = await serialQueue.add(() => httpAPI('POST', '/rfid/users', body))
    if (!res || res === 'error' || res.msg === 'error') return false
    update((s) => ({ ...s, users: { ...s.users, [uid]: name } }))
    return true
  }

  async function remove(uid) {
    const url = `/rfid/users?rfid=${encodeURIComponent(uid)}`
    const res = await serialQueue.add(() => httpAPI('DELETE', url))
    if (!res || res === 'error' || res.msg === 'error') return false
    update((s) => {
      const next = { ...s.users }
      delete next[uid]
      return { ...s, users: next }
    })
    return true
  }

  return {
    subscribe,
    set,
    reset: () => set(emptyState()),
    download,
    save,
    remove,
  }
}

export const rfid_users_store = createRfidUsersStore()
