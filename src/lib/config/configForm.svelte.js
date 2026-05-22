// src/lib/config/configForm.svelte.js
// Per-field save machinery shared by every config page. createConfigForm()
// returns a saveState store, a `revert` counter (bumped on failure so
// controlled inputs resync to the confirmed store value), and the save fns.
import { config_store } from '../stores/config.js'
import { serialQueue } from '../queue.js'
import { showWriteError } from '../alerts.js'
import { createSaveState } from './saveState.js'

export function createConfigForm() {
  const saveState = createSaveState()
  let revert = $state(0)

  async function saveFields(fields) {
    const names = Object.keys(fields)
    names.forEach((n) => saveState.begin(n))
    const ok = await serialQueue.add(() => config_store.upload(fields))
    if (ok) {
      config_store.update((c) => ({ ...c, ...fields }))
      names.forEach((n) => saveState.succeed(n))
    } else {
      names.forEach((n) => saveState.fail(n))
      revert += 1
      showWriteError()
    }
    return ok
  }

  function saveField(name, value) {
    return saveFields({ [name]: value })
  }

  return {
    saveState,
    saveField,
    saveFields,
    get revert() {
      return revert
    },
  }
}
