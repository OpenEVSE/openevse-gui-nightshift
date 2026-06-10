import { readable } from 'svelte/store'

function readHash() {
  const h = window.location.hash.replace(/^#/, '')
  return h || '/'
}

export const currentPath = readable(readHash(), (set) => {
  const update = () => set(readHash())
  window.addEventListener('hashchange', update)
  update()
  return () => window.removeEventListener('hashchange', update)
})

export function navigate(path) {
  window.location.hash = path
}

/** Like navigate, but without a history entry — Back skips the old URL. */
export function redirect(path) {
  window.history.replaceState(null, '', '#' + path)
  // replaceState doesn't fire hashchange; currentPath listens for it.
  window.dispatchEvent(new Event('hashchange'))
}
