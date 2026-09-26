import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// iconify-icon registers a custom element that fetches icons asynchronously.
// In jsdom, its render timers can fire after a test file has torn down its
// document, producing unhandled `ReferenceError: document is not defined`
// errors that fail the run. Tests only need the bare <iconify-icon> tag —
// stub the module so no custom element / timers are registered.
vi.mock('iconify-icon', () => ({}))

// jsdom doesn't implement these browser APIs that uPlot (transitively imported
// by chart components) and other libs touch at module-load time.
if (typeof globalThis.matchMedia !== 'function') {
  globalThis.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
if (typeof globalThis.MutationObserver !== 'function') {
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() { return [] }
  }
}

// Node 25+ defines `localStorage` as a global accessor backed by
// --localstorage-file; without that flag the binding still exists but is
// non-functional (setItem etc. throw/are missing). Because the binding
// exists it shadows the one jsdom installs — window === globalThis here, so
// `window.localStorage` is the same broken object — and anything touching
// storage fails rather than reaching jsdom's implementation. Checking only
// for a *missing* localStorage isn't enough here; check it actually works.
// The accessor is configurable, so defineProperty replaces it with a
// minimal in-memory Storage.
if (typeof globalThis.localStorage?.setItem !== 'function') {
  const store = new Map()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
      setItem: (key, value) => { store.set(String(key), String(value)) },
      removeItem: (key) => { store.delete(String(key)) },
      clear: () => { store.clear() },
      key: (index) => [...store.keys()][index] ?? null,
      get length() { return store.size },
    },
  })
}
