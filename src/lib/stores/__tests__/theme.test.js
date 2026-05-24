import { describe, it, expect, beforeEach, vi } from 'vitest'
import { get } from 'svelte/store'

function mockMatchMedia(prefersDark) {
  window.matchMedia = vi.fn(() => ({
    matches: prefersDark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

describe('theme store', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((node) => node.remove())
  })

  it('resolves to the OS preference when no override is set', async () => {
    mockMatchMedia(true)
    const { theme } = await import('../theme.js')
    expect(get(theme).resolved).toBe('dark')
  })

  it('applies the resolved theme to the document element', async () => {
    mockMatchMedia(false)
    const { theme } = await import('../theme.js')
    theme.init()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('setTheme overrides the OS preference and persists it', async () => {
    mockMatchMedia(true)
    const { theme } = await import('../theme.js')
    theme.setTheme('light')
    expect(get(theme).resolved).toBe('light')
    expect(JSON.parse(localStorage.getItem('oevse-theme'))).toBe('light')
  })

  it('setTheme("system") clears the override', async () => {
    mockMatchMedia(true)
    const { theme } = await import('../theme.js')
    theme.setTheme('light')
    theme.setTheme('system')
    expect(get(theme).override).toBe(null)
    expect(get(theme).resolved).toBe('dark')
  })

  it('syncs a single <meta name="theme-color"> to the resolved theme', async () => {
    // Simulate the index.html static defaults — two media-query metas.
    const lightMeta = document.createElement('meta')
    lightMeta.setAttribute('name', 'theme-color')
    lightMeta.setAttribute('media', '(prefers-color-scheme: light)')
    lightMeta.setAttribute('content', '#ffffff')
    document.head.appendChild(lightMeta)
    const darkMeta = document.createElement('meta')
    darkMeta.setAttribute('name', 'theme-color')
    darkMeta.setAttribute('media', '(prefers-color-scheme: dark)')
    darkMeta.setAttribute('content', '#0c0e13')
    document.head.appendChild(darkMeta)

    mockMatchMedia(true)
    const { theme } = await import('../theme.js')
    theme.init()

    const metas = document.querySelectorAll('meta[name="theme-color"]')
    expect(metas.length).toBe(1)
    expect(metas[0].getAttribute('content')).toBe('#0c0e13')
    expect(metas[0].hasAttribute('media')).toBe(false)

    theme.setTheme('light')
    const updated = document.querySelectorAll('meta[name="theme-color"]')
    expect(updated.length).toBe(1)
    expect(updated[0].getAttribute('content')).toBe('#ffffff')
  })
})
