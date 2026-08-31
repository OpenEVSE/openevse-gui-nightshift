import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

// Drive the native-host bridge from the test: a writable stands in for the
// readable store so we can flip hasDrawer, and openDrawer is a spy.
vi.mock('../../../nativeHost.js', async () => {
  const { writable } = await import('svelte/store')
  return { host: writable({ embedded: false, hasDrawer: false }), openDrawer: vi.fn() }
})

import { host as mockHost, openDrawer } from '../../../nativeHost.js'
import BottomNav from '../BottomNav.svelte'

beforeEach(() => {
  mockHost.set({ embedded: false, hasDrawer: false })
  openDrawer.mockClear()
})

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

  it('hides the app-drawer button outside the phone app', () => {
    // Default bridge state: not embedded — plain browser sees only the 5 routes.
    const { getAllByRole, queryByRole } = render(BottomNav, { props: { path: '/' } })
    expect(getAllByRole('link')).toHaveLength(5)
    expect(queryByRole('button', { name: 'nav.app' })).toBeNull()
  })

  it('shows a drawer button inside the app that opens the drawer without touching the route', async () => {
    mockHost.set({ embedded: true, hasDrawer: true })
    window.location.hash = '#/schedule'

    const { getByRole, getAllByRole } = render(BottomNav, { props: { path: '/schedule' } })

    // It is a button, not a sixth link — the route/tab must be untouched.
    expect(getAllByRole('link')).toHaveLength(5)
    const btn = getByRole('button', { name: 'nav.app' })
    expect(btn.tagName).toBe('BUTTON')
    expect(btn).not.toHaveAttribute('href')

    await fireEvent.click(btn)
    expect(openDrawer).toHaveBeenCalledTimes(1)
    expect(window.location.hash).toBe('#/schedule') // hash unchanged
  })
})
