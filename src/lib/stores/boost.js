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
            // {} = idle. On firmware without Boost, GET /boost 404s with a
            // non-JSON body, so httpAPI's response.json() throws and the catch
            // returns the string 'error' → the failure branch below. (httpAPI
            // does NOT translate the 404 itself; it only special-cases 401.
            // It never exposes the status code either, which is why the
            // capability check is a boost_version gate in DataManager, not a
            // 200-vs-404 probe here — and that gate means an unsupported device
            // never reaches this download at all.)
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
        // mirroring how the limit store treats "no limit". Note this reply
        // arrives with a 404 status: it works because httpAPI passes every
        // non-401 response straight to response.json(), so the {"msg":"no
        // boost"} body parses normally. If httpAPI were ever changed to
        // collapse 404s to 'error', idempotent cancel would silently break —
        // this path depends on the 404 body being parsed, not swallowed.
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
