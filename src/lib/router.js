import { readable } from 'svelte/store'

function readHash() {
  const h = window.location.hash.replace(/^#/, '')
  return h || '/'
}

// iOS 17 WebKit promotes same-document fragment navigations on a
// stale-cached document into FULL page loads — the splash-on-every-tap bug.
// history.pushState is not a navigation (it's a session-history API call),
// so route changes made through it are structurally immune. redirect()
// below has always worked this way via replaceState, which is why it was
// never implicated.
function pushHash(hash) {
  if (window.location.hash !== hash) {
    window.history.pushState(null, '', hash)
  }
  // pushState doesn't fire hashchange; currentPath listens for it. Fired
  // even for a same-route re-tap so listeners can react if they want.
  window.dispatchEvent(new Event('hashchange'))
}

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0) return
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = e.target instanceof Element ? e.target.closest('a[href^="#"]') : null
  if (!a) return
  e.preventDefault()
  pushHash(a.getAttribute('href'))
})

export const currentPath = readable(readHash(), (set) => {
  const update = () => set(readHash())
  // pushState-created entries don't fire hashchange on Back/Forward in all
  // engines, so listen for popstate too.
  window.addEventListener('hashchange', update)
  window.addEventListener('popstate', update)
  update()
  return () => {
    window.removeEventListener('hashchange', update)
    window.removeEventListener('popstate', update)
  }
})

export function navigate(path) {
  pushHash('#' + path)
}

/** Like navigate, but without a history entry — Back skips the old URL. */
export function redirect(path) {
  window.history.replaceState(null, '', '#' + path)
  // replaceState doesn't fire hashchange; currentPath listens for it.
  window.dispatchEvent(new Event('hashchange'))
}
