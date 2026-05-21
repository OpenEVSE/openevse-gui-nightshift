import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  const isLoading = { subscribe: (fn) => { fn(false); return () => {} } }
  return { _: t, isLoading, register: vi.fn(), init: vi.fn(), getLocaleFromNavigator: () => 'en' }
})
vi.mock('../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve('error')) }))

import App from '../App.svelte'

describe('App', () => {
  it('renders the loader before data has loaded', () => {
    const { container } = render(App)
    // Loader covers the screen; the BottomNav (a <nav>) is not present yet.
    expect(container.querySelector('nav')).not.toBeInTheDocument()
  })
})
