// src/lib/config/saveState.js
// Per-field save-status state. createSaveState() returns a Svelte store
// mapping field name -> 'saving' | 'saved' | 'error'. A name absent from the
// map is 'idle'. succeed() lingers on 'saved' then auto-clears to 'idle'.
import { writable } from 'svelte/store'

export const SAVED_LINGER_MS = 2000

export function createSaveState() {
  const { subscribe, update } = writable({})
  const timers = {}

  function clearTimer(name) {
    if (timers[name]) {
      clearTimeout(timers[name])
      delete timers[name]
    }
  }
  function setStatus(name, status) {
    update((m) => ({ ...m, [name]: status }))
  }

  return {
    subscribe,
    begin(name) {
      clearTimer(name)
      setStatus(name, 'saving')
    },
    succeed(name) {
      clearTimer(name)
      setStatus(name, 'saved')
      timers[name] = setTimeout(() => {
        delete timers[name]
        setStatus(name, 'idle')
      }, SAVED_LINGER_MS)
    },
    fail(name) {
      clearTimer(name)
      setStatus(name, 'error')
    },
  }
}
