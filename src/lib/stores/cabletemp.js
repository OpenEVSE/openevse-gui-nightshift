// src/lib/stores/cabletemp.js
// Cable NTC thermistor monitoring — dedicated endpoint (not /config: the
// per-source configuration is ~20 fields and /config's document capacity is
// already nearly exhausted). See openevse_esp32_firmware's
// src/web_server.cpp handleCableTemp() for the wire format.
//
// GET  /cabletemp -> {supported, enabled, sources:[{source,name,pin,status,
//                     temperature?,r25?,beta?,offset_c10?,panic_c10?} x4]}
// POST /cabletemp <- {source:0-3, pin:0-2 [,r25,beta,offset_c10,panic_c10]}
//   Omitting the four calibration fields reassigns the pin only. If any one
//   of them is present, all four must be (the controller 400s otherwise).
import { writable } from 'svelte/store'
import { httpAPI } from '../api/httpAPI.js'

function createCableTempStore() {
  const P = writable(null)
  const { subscribe, set } = P

  async function download() {
    const res = await httpAPI('GET', '/cabletemp')
    if (res && res !== 'error' && Array.isArray(res.sources)) {
      set(res)
      return true
    }
    return false
  }

  async function upload(data) {
    const res = await httpAPI('POST', '/cabletemp', JSON.stringify(data))
    return !!(res && res.msg === 'done')
  }

  return { subscribe, set, download, upload }
}

export const cabletemp_store = createCableTempStore()
