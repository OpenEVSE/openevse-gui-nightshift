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
})
