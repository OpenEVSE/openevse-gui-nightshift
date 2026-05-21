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
