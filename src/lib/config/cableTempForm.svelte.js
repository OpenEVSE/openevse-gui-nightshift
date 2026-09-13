// src/lib/config/cableTempForm.svelte.js
// Write orchestration for /cabletemp, parallel to configForm.svelte.js but
// not built on it: /cabletemp is its own endpoint, not a config_store field,
// and reassigning a physical input's source is a two-step read-modify-write
// (unassign whatever source was on that pin, then assign the new one) rather
// than a single field write.
import { cabletemp_store } from '../stores/cabletemp.js'
import { serialQueue } from '../queue.js'
import { showWriteError } from '../alerts.js'
import { createSaveState } from './saveState.js'
import { cableTempSourceOnPin, CABLE_TEMP_PIN_NONE } from '../cabletemp.js'

export function createCableTempForm() {
  const saveState = createSaveState()
  let busy = $state(false)

  async function refresh() {
    return serialQueue.add(() => cabletemp_store.download())
  }

  /**
   * Reassign (or clear, with newSource = null) the source wired to one
   * physical pin. A no-op if that pin already reports the requested source.
   */
  async function setPin(cabletemp, pin, newSource) {
    const name = `pin${pin}`
    const current = cableTempSourceOnPin(cabletemp, pin)?.source ?? null
    if (current === newSource) return true

    saveState.begin(name)
    busy = true
    let ok = true
    if (current !== null) {
      ok = await serialQueue.add(() => cabletemp_store.upload({ source: current, pin: CABLE_TEMP_PIN_NONE }))
    }
    if (ok && newSource !== null) {
      ok = await serialQueue.add(() => cabletemp_store.upload({ source: newSource, pin }))
    }
    if (ok) ok = await refresh()
    busy = false

    if (ok) saveState.succeed(name)
    else { saveState.fail(name); showWriteError() }
    return ok
  }

  /**
   * Update one calibration field for a source, re-sending the other three
   * unchanged (the endpoint requires all four calibration fields together)
   * and leaving its pin assignment alone.
   */
  async function saveField(source, current, field, value) {
    const name = `source${source}_${field}`
    saveState.begin(name)
    busy = true
    const payload = {
      source,
      pin: current.pin,
      r25: current.r25,
      beta: current.beta,
      offset_c10: current.offset_c10,
      panic_c10: current.panic_c10,
      [field]: value,
    }
    let ok = await serialQueue.add(() => cabletemp_store.upload(payload))
    if (ok) ok = await refresh()
    busy = false

    if (ok) saveState.succeed(name)
    else { saveState.fail(name); showWriteError() }
    return ok
  }

  return {
    saveState,
    get busy() { return busy },
    refresh,
    setPin,
    saveField,
  }
}
