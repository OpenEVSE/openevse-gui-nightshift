import { writable }         from 'svelte/store'
import { httpAPI }           from '../api/httpAPI.js'

// Boost = "charge NOW until a target is reached, then hand control back."
// A dedicated device-side claim (priority 200) owns the countdown — the UI
// only arms/cancels and mirrors what the device reports. Never persisted; a
// reboot clears it. See src/lib/stores/limit.js for the sibling pattern this
// deliberately mirrors.
//
// Idle is the empty object {} from GET /boost (a 200, NOT a 404) — normalised
// here to this model so consumers can test `type !== 'none'` uniformly.
let model = {
    type: "none",
    value: 0,
}

function createBoostStore() {
    const P  = writable(model)
    const { subscribe, set, update } = P

    async function download() {
        let res = await httpAPI("GET", "/boost")
        if (res && res.hasOwnProperty("type")) {
            // Active: {type, value, remaining, started}
            P.update(() => res)
            return true
        }
        else if (res && typeof res === "object") {
            // {} = idle. (Unsupported firmware 404s and httpAPI returns the
            // string 'error', which falls through to the failure branch — but
            // DataManager gates the download on boost_version presence, so an
            // unsupported device never reaches here.)
            P.update(() => model)
            return true
        }
        else return false
    }

    async function upload(data) {
        // Returns the parsed body so the caller can distinguish:
        //   201 {msg:"done"}                    → armed / replaced
        //   400 {msg:"failed to parse JSON"}    → rejected input
        //   422 {msg:"no vehicle data source…"} → no soc/range source
        //   'error'                             → network / parse failure
        // Never infer "a boost is now running" from the 201 — an already-met
        // soc/range target also returns 201 but leaves nothing running. The
        // caller reconciles from download()/boost_version.
        return await httpAPI("POST", "/boost", JSON.stringify(data))
    }

    async function remove() {
        let res = await httpAPI("DELETE", "/boost")
        // "no boost" = nothing to cancel — success for an idempotent remove,
        // mirroring how the limit store treats "no limit".
        if (res && (res.msg === "done" || res.msg === "no boost")) {
            P.update(() => model)
            return true
        }
        else return false
    }

    function reset() {
        P.update(() => model)
        return true
    }

    return {
        subscribe,
        set,
        update,
        download,
        reset,
        remove,
        upload: (data) => upload(data),
    }
}

export const boost_store = createBoostStore()
