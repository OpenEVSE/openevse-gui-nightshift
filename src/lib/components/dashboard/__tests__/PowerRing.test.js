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
  it('stacks an emphasized detail line under the reason when sleeping', () => {
    const { getByText } = render(PowerRing, {
      props: {
        display: 'sleeping',
        reasonKey: 'dashboard.reason.timer',
        reasonValues: { since: '14:00' },
        reasonDetail: { key: 'dashboard.reason.timer_on', values: { at: '08:00' } },
      },
    })
    expect(getByText('dashboard.reason.timer')).toBeInTheDocument()
    const detail = getByText('dashboard.reason.timer_on')
    expect(detail.className).toContain('font-semibold')
  })
})
