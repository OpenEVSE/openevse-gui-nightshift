import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import PowerRing from '../PowerRing.svelte'

describe('PowerRing', () => {
  it('shows kW when charging', () => {
    const { getByText } = render(PowerRing, {
      props: { display: 'charging', fill: 0.6, kw: '7.4', maxKw: '11.5' },
    })
    expect(getByText('7.4')).toBeInTheDocument()
  })
  it('shows the ready label when idle', () => {
    const { getByText } = render(PowerRing, { props: { display: 'idle', fill: 0 } })
    expect(getByText(/^dashboard\.ring\.ready$/)).toBeInTheDocument()
  })
})
