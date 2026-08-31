// Bridge to the OpenEVSE phone app when the GUI is shown inside its WebView.
// The app injects `window.OpenEVSEHost` and `window.ReactNativeWebView`; a
// plain browser has neither, so the UI is unchanged there.
//
// Detection can't be a one-time read: on Android the before-content injection
// is an async evaluateJavascript from onPageStarted, so this bundle can run
// first. The app therefore also sets the global at document end and fires a
// `openevsehost` event — hence the store + listener below, and an idempotent
// `announce()` guarded by a once-only flag.
import { readable } from 'svelte/store'

const w = window

// Never let a missing/throwing bridge break the page.
const post = (msg) => {
  try {
    w.ReactNativeWebView.postMessage(JSON.stringify(msg))
  } catch {
    // no bridge (plain browser) or it threw — ignore
  }
}

const read = () => {
  const host = w.OpenEVSEHost
  const embedded = !!host && !!w.ReactNativeWebView
  return { embedded, hasDrawer: embedded && host.drawer === true }
}

let announced = false
let current = read()

// Tell the app once that this GUI renders its own drawer button, so the app
// can drop its fallback (Android floating button). Safe to call repeatedly —
// the flag makes every call after the first a no-op.
export const announce = () => {
  if (current.embedded && !announced) {
    announced = true
    post({ type: 'hostUi', drawerButton: current.hasDrawer })
  }
}

// Live { embedded, hasDrawer }. Re-reads and re-announces when the app's late
// `openevsehost` event fires (the Android bundle-first race).
export const host = readable(current, (set) => {
  const onLate = () => {
    current = read()
    set(current)
    announce()
  }
  w.addEventListener('openevsehost', onLate)
  return () => w.removeEventListener('openevsehost', onLate)
})

export const openDrawer = () => post({ type: 'openDrawer' })
