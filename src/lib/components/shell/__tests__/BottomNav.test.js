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
    const { getAllByRole } = render(BottomNav, { props: { path: '/' } })
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
