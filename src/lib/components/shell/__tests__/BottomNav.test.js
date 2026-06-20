import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import BottomNav from '../BottomNav.svelte'

describe('BottomNav', () => {
  it('renders a link for each of the five primary routes', () => {
    const { getAllByRole } = render(BottomNav, { props: { path: '/', caps: { charts: true, history: true } } })
    expect(getAllByRole('link')).toHaveLength(5)
  })

  it('marks the active route with aria-current', () => {
    const { getByLabelText } = render(BottomNav, { props: { path: '/schedule' } })
    expect(getByLabelText('nav.schedule')).toHaveAttribute('aria-current', 'page')
  })

  it('carries the desktop labeled-rail classes', () => {
    const { container, getAllByRole } = render(BottomNav, { props: { path: '/' } })
    expect(container.querySelector('nav').className).toContain('lg:w-44')
    for (const link of getAllByRole('link')) {
      expect(link.className).toContain('lg:flex-row')
    }
  })

  it('shows the desktop-only brand above the nav items', () => {
    const { getByText } = render(BottomNav, { props: { path: '/', deviceName: 'Garage EVSE' } })
    const brand = getByText('Garage EVSE').closest('div')
    expect(brand.className).toContain('hidden')   // mobile: not shown
    expect(brand.className).toContain('lg:flex')  // desktop rail: shown
    expect(brand.className).toContain('border-b') // rule below the brand
  })
})

describe('BottomNav capability gating', () => {
  it('shows monitoring and history when capable', () => {
    const { queryByLabelText } = render(BottomNav, { props: { caps: { charts: true, history: true } } })
    expect(queryByLabelText('nav.monitoring')).toBeInTheDocument()
    expect(queryByLabelText('nav.history')).toBeInTheDocument()
  })
  it('hides monitoring when charts are stripped and history when unavailable', () => {
    const { queryByLabelText } = render(BottomNav, { props: { caps: { charts: false, history: false } } })
    expect(queryByLabelText('nav.monitoring')).not.toBeInTheDocument()
    expect(queryByLabelText('nav.history')).not.toBeInTheDocument()
    expect(queryByLabelText('nav.home')).toBeInTheDocument()
  })
})
