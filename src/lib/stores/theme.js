import { writable } from 'svelte/store'

const STORAGE_KEY = 'oevse-theme'

// Kept in sync with --surface in src/app.css. The system chrome (iOS status
// bar tint, Android task switcher) reads this from <meta name="theme-color">.
const THEME_COLORS = { light: '#ffffff', dark: '#0c0e13' }

function syncThemeColorMeta(resolved) {
  if (typeof document === 'undefined') return
  // Remove the static media-query metas baked into index.html — once we know
  // the resolved theme (including any user override) we drive a single tag.
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((node) => node.remove())
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'theme-color')
  meta.setAttribute('content', THEME_COLORS[resolved] || THEME_COLORS.dark)
  document.head.appendChild(meta)
}

function osPrefersDark() {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function readOverride() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const val = raw ? JSON.parse(raw) : null
    return val === 'light' || val === 'dark' ? val : null
  } catch {
    return null
  }
}

function resolve(override) {
  if (override) return override
  return osPrefersDark() ? 'dark' : 'light'
}

function createThemeStore() {
  const override = readOverride()
  const { subscribe, set } = writable({ override, resolved: resolve(override) })
  let current = { override, resolved: resolve(override) }

  function apply(state) {
    current = state
    set(state)
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', state.resolved)
    }
    syncThemeColorMeta(state.resolved)
  }

  function setTheme(choice) {
    const next = choice === 'system' ? null : choice
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* storage unavailable — keep in-memory only */
    }
    apply({ override: next, resolved: resolve(next) })
  }

  function init() {
    apply(current)
    if (typeof window !== 'undefined' && window.matchMedia) {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => {
          if (!current.override) apply({ override: null, resolved: resolve(null) })
        })
    }
  }

  return { subscribe, setTheme, init }
}

export const theme = createThemeStore()
