import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ChargeLimitCard from '../ChargeLimitCard.svelte'

describe('ChargeLimitCard', () => {
  it('shows "none set" and calls onopen when no time/energy limit', async () => {
    const onopen = vi.fn()
    const { getByText } = render(ChargeLimitCard, {
      props: { hasSoc: false, limit: { type: 'none' }, onopen },
    })
    expect(getByText('dashboard.limit.none')).toBeInTheDocument()
    await fireEvent.click(getByText('dashboard.limit.set'))
    expect(onopen).toHaveBeenCalledOnce()
  })

  it('shows the time/energy summary and calls onclear', async () => {
    const onclear = vi.fn()
    const { getByText, getByLabelText } = render(ChargeLimitCard, {
      props: { hasSoc: false, limit: { type: 'energy', value: 10000 }, summary: '10 kWh', onclear },
    })
    expect(getByText('10 kWh')).toBeInTheDocument()
    await fireEvent.click(getByLabelText('dashboard.limit.clear'))
    expect(onclear).toHaveBeenCalledOnce()
  })

  it('does not treat a soc/range limit as an active row (bar owns it)', () => {
    const { getByText } = render(ChargeLimitCard, {
      props: { hasSoc: true, soc: 74, vehicleLimit: 90, target: 80, limit: { type: 'soc', value: 80 }, summary: '80%' },
    })
    expect(getByText('dashboard.limit.none')).toBeInTheDocument()
  })

  it('renders the bar when hasSoc', () => {
    const { getByRole } = render(ChargeLimitCard, {
      props: { hasSoc: true, soc: 74, vehicleLimit: 90, target: 80, limit: { type: 'none' } },
    })
    expect(getByRole('slider', { name: 'dashboard.vehicle.target_aria' })).toBeInTheDocument()
  })

  it('hides the bar when not hasSoc', () => {
    const { queryByRole } = render(ChargeLimitCard, {
      props: { hasSoc: false, limit: { type: 'none' } },
    })
    expect(queryByRole('slider', { name: 'dashboard.vehicle.target_aria' })).not.toBeInTheDocument()
  })

  it('hides the clear button (and the set button) when not clearable', () => {
    const { getByText, queryByLabelText, queryByText } = render(ChargeLimitCard, {
      props: {
        hasSoc: false,
        limit: { type: 'energy', value: 10000 },
        summary: '10 kWh',
        clearable: false,
      },
    })
    expect(getByText('10 kWh')).toBeInTheDocument() // summary still shows
    expect(queryByLabelText('dashboard.limit.clear')).not.toBeInTheDocument()
    expect(queryByText('dashboard.limit.set')).not.toBeInTheDocument()
  })
})
