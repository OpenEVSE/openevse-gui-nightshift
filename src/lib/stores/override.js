import { get, writable } from 'svelte/store'
import {httpAPI} from '../api/httpAPI.js'
import {status_store} from './status.js'


// const model = {
// 	// state: undefined,
//     // max_current: undefined,
//     // charge_current: undefined,
//     // auto_release: undefined,
//     // msg: undefined
//   }

function createOverrideStore() {
    const P  = writable()
    const { subscribe, update } = P
    // Wall-clock moment the store's value was last set (any of download,
    // upload, clear, or a direct set()). remainingBoostSeconds() below
    // subtracts elapsed time since this anchor from a stored `remaining` /
    // `duration` field, so a caller reading the store seconds or minutes
    // after the write still gets an accurate figure — not the original
    // snapshot re-served stale.
    let anchorMs = 0
    function setValue(v) {
        anchorMs = Date.now()
        P.set(v)
    }

	async function download() {
        let res = await httpAPI("GET", "/override")
        if (res?.msg == undefined) {
            setValue(res)
            return true
        }
        else if (res?.msg === 'No manual override') {
            setValue({})
            return true
        }
        else {
            return false
        }
    }
    async function upload(data) {
        // `remaining` is a read-only field the device reports on GET (seconds
        // left on a device-side timer) — it must never be sent back in a POST.
        // Strip it centrally so no call site (e.g. one that spreads a
        // downloaded override back into an upload) can leak a stale value that
        // the firmware would either ignore or misinterpret, and so the store
        // never re-derives a countdown from a value we just POSTed ourselves.
        const { remaining, ...payload } = data || {}
        let res = await httpAPI("POST", "/override", JSON.stringify(payload))
        // Update the store only on a confirmed success — never show an
        // override the device did not accept. httpAPI yields "error" on a
        // failed request; a msg:"error" body is also a failure.
        if (res && res !== "error" && res?.msg !== "error") {
            setValue(payload)
            return true
        }
        return false
    }
    async function clear() {
        if (get(P)) {
            let res = await httpAPI("DELETE", "/override")
            // Same success guard as upload(): httpAPI yields the string
            // "error" on a failed request, which is truthy and was
            // previously read as success here — a network-failed Cancel
            // would silently empty the store (hiding an active boost's
            // countdown) while reporting success, with no version bump to
            // ever self-correct it.
            if (res && res !== "error" && res?.msg !== "error") {
                setValue({})
                return true
            } else return false
        }
        else return false
    }

    async function toggle() {
        let res = await httpAPI("PATCH", "/override")
        if (res.msg === "Updated") {
            return true
        }
        else return false
    }

    // Seconds left on a live device-side boost timer right now, or null if
    // there isn't one. Prefers a GET's `remaining`; falls back to a
    // just-uploaded `duration` when no GET has landed yet (our own optimistic
    // write). Both are anchored to `anchorMs` — see setValue() above — so
    // this stays accurate however long ago the store was last written.
    function remainingBoostSeconds() {
        const o = get(P)
        if (!o || typeof o !== 'object') return null
        const base =
            typeof o.remaining === 'number' && o.remaining > 0
                ? o.remaining
                : typeof o.duration === 'number' && o.duration > 0
                    ? o.duration
                    : null
        if (base == null) return null
        const elapsedSec = (Date.now() - anchorMs) / 1000
        const left = Math.ceil(base - elapsedSec)
        return left > 0 ? left : null
    }

    // Given override fields a caller wants to write, preserve a currently
    // live boost timer: strip any `duration`/`remaining` the caller passed
    // in and, if a boost is active, replace them with the live remaining
    // seconds as `duration`. This is a "keep the existing timer running"
    // helper, not a "start one" helper — call sites that want to arm a
    // brand-new boost (see Dashboard's boost()) should set `duration`
    // themselves and upload directly instead of going through this.
    //
    // Centralizing this here — rather than in each caller — is what makes
    // the invariant "an override re-POST while a boost is active must carry
    // the remaining duration and never `remaining`" hold everywhere: both
    // Dashboard's rate-change path and ChargeManager's clear-always-on path
    // (via removeProp() below) route through it, and any future call site
    // that reaches upload()/removeProp() gets the same protection for free.
    function preserveBoostDuration(payload) {
        const { duration, remaining, ...rest } = payload || {}
        const secs = remainingBoostSeconds()
        return secs != null ? { ...rest, duration: secs } : rest
    }

    async function removeProp(prop) {
        let override = get(P)
        let res
        if (override && override[prop]) {
            // Copy rather than mutate the store's live object in place.
            override = { ...override }
            delete override[prop]
            if (Object.keys(override).length  == 1 && override.auto_release != undefined) {
                // there's only one key check if it's auto_release
                res = await clear()
                return res
            } else {
                // preserveBoostDuration is a no-op when no boost is active,
                // so this degrades to the original upload(override) call in
                // every other case.
                res = await upload(preserveBoostDuration(override))
                return res
            }
        }
        return false
    }


    return {
        subscribe,
		get: (s) => get(s), // little hack to access get() method inside the object itself
        set: (v) => setValue(v),
        update,
        download,
        clear,
        upload: (data) => upload(data),
        toggle,
        removeProp: (prop) => removeProp(prop),
        remainingBoostSeconds,
        preserveBoostDuration,
    }
}

export const override_store = createOverrideStore()
