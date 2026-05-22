// src/routes/settings/__tests__/About.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import { config_store } from '../../../lib/stores/config.js'
import About from '../About.svelte'

beforeEach(() => {
  config_store.set({ firmware: '7.1.3', version: '5.1.2' })
})

describe('About page', () => {
  it('shows the firmware and gateway versions', () => {
    const { getByText } = render(About)
    expect(getByText('7.1.3')).toBeInTheDocument()
    expect(getByText('5.1.2')).toBeInTheDocument()
  })
  it('links to the documentation', () => {
    const { getAllByRole } = render(About)
    const hrefs = getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs.some((h) => h && h.includes('openevse'))).toBe(true)
  })
})
