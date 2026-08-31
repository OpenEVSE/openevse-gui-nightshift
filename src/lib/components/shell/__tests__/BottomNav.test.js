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
    expect(getByLabelText('nav.charge_manager')).toHaveAttribute('aria-current', 'page')
  })

  it('carries the desktop labeled-rail classes', () => {
    const { container, getAllByRole } = render(BottomNav, { props: { path: '/' } })
    expect(container.querySelector('nav').className).toContain('sm:w-24')
    expect(container.querySelector('nav').className).toContain('lg:w-52')
    for (const link of getAllByRole('link')) {
      expect(link.className).toContain('lg:flex-row')
    }
  })

  it('reserves a fixed two-line label height only on the tablet rail (sm..lg)', () => {
    // A label that wraps to two lines in the narrow tablet rail must not push its
    // icon off the shared baseline, so every label reserves two lines — but only
    // in the sm..lg window, leaving the mobile bar and the lg row layout in their
    // natural single-line flow.
    const { getByLabelText } = render(BottomNav, { props: { path: '/' } })
    const label = getByLabelText('nav.charge_manager').querySelector('span')
    expect(label.className).toContain('sm:max-lg:h-[26px]')
    // No unscoped/lg height override — desktop keeps the natural flow.
    expect(label.className).not.toContain('lg:block')
  })

  it('shows the desktop-only brand above the nav items', () => {
    const { getByText } = render(BottomNav, { props: { path: '/', deviceName: 'Garage EVSE' } })
    const brand = getByText('Garage EVSE').closest('div')
    expect(brand.className).toContain('hidden')   // mobile: not shown
    expect(brand.className).toContain('lg:flex')  // desktop rail: shown
    expect(brand.className).toContain('border-b') // rule below the brand
  })
})
