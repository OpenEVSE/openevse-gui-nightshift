// iOS standalone PWA quirk: env(safe-area-inset-*) reads as 0 on the first
// paint and only resolves after a layout reflow. With our flex layout that
// shows up as a gap under the bottom nav on launch — visible until the user
// scrolls or interacts.
//
// Workaround: at runtime, write a hidden probe element whose height is
// env(safe-area-inset-bottom), read its computed height, and store the
// result in a CSS variable. The bottom nav reads --safe-bottom instead of
// env() directly. We re-probe across animation frames and on viewport
// events so the value catches up the moment iOS resolves env() properly.

function readEnvHeight(envExpr) {
  const probe = document.createElement('div')
  probe.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:0;height:${envExpr};pointer-events:none;`
  document.body.appendChild(probe)
  const h = probe.getBoundingClientRect().height
  document.body.removeChild(probe)
  return h
}

function syncOnce() {
  const bottom = readEnvHeight('env(safe-area-inset-bottom)')
  const top = readEnvHeight('env(safe-area-inset-top)')
  document.documentElement.style.setProperty('--safe-bottom', `${bottom}px`)
  document.documentElement.style.setProperty('--safe-top', `${top}px`)
}

// Kick iOS's compositor into resolving env(safe-area-inset-*). On standalone
// PWA launch env() reports 0 to CSS and stays there until a *real*
// composited paint cycle — a non-zero transform change is the smallest such
// trigger. Static transform: translateY(0) is a no-op the browser optimizes
// out, which is why it doesn't help that PullToRefresh already has one;
// only when the user pulls (non-zero translate) does iOS recompute env().
// We do that programmatically here so the user doesn't have to.
function kickCompositor() {
  document.body.style.transform = 'translateZ(0.01px)'
  requestAnimationFrame(() => {
    document.body.style.transform = ''
  })
}

export function initSafeArea() {
  syncOnce()
  kickCompositor()
  // Several rAF passes catch the iOS PWA late-resolve cycle (the right
  // value typically lands a frame or two after the compositor kick).
  let rafs = 8
  function tick() {
    syncOnce()
    if (--rafs > 0) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  // Stay in sync on orientation / viewport changes too.
  window.addEventListener('resize', syncOnce)
  window.addEventListener('orientationchange', syncOnce)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      kickCompositor()
      syncOnce()
    }
  })
}
