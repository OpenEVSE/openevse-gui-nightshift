import { writable } from 'svelte/store'
import { httpAPI } from '../api/httpAPI.js'

function createCertificateStore() {
  const P = writable([])
  const { subscribe, set, update } = P

  async function download() {
    let res = await httpAPI("GET", "/certificates")
    if (res && (res.msg != "error" && res != "error")) {
      P.update(() => res)
      return true
    }
    else return false
  }

  async function upload(data) {
    let res = await httpAPI("POST", "/certificates", JSON.stringify(data))
    res.success = res.msg == "done"
    return res
  }

  // Asks the firmware to generate a self-signed certificate/key pair and store
  // it. Generation happens on-device because the private key must never leave
  // it. Native/OpenSSL builds answer 501 -- mbedTLS is the only backend that
  // implements this -- so surface the firmware's message rather than a generic
  // failure.
  async function generateSelfSigned() {
    let res = await httpAPI("POST", "/certificates/self-signed")
    if (res && res.msg == "done") {
      return { success: true, id: res.id }
    }
    return { success: false, msg: res && res.msg ? res.msg : null }
  }

  async function remove(id) {
    let res = await httpAPI("DELETE", "/certificates/" + id)
    if (res.msg == "done")
      return true
    else return false
  }

  return {
    subscribe,
    set,
    update,
    download,
    remove: (id) => remove(id),
    generateSelfSigned,
    upload: (certificate) => upload(certificate)
  }
}

export const certificate_store = createCertificateStore()