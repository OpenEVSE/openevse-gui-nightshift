import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ChargeLimitCard from '../ChargeLimitCard.svelte'

describe('ChargeLimitCard', () => {
  it('shows "none set" and calls onopen when no limit', async () => {
    const onopen = vi.fn()
    const { getByText } = render(ChargeLimitCard, {
      props: { limit: { type: 'none' }, onopen },
    })
    expect(getByText('dashboard.limit.none')).toBeInTheDocument()
    await fireEvent.click(getByText('dashboard.limit.set'))
    expect(onopen).toHaveBeenCalledOnce()
  })
  it('shows the active limit summary and calls onclear', async () => {
    const onclear = vi.fn()
    const { getByText, getByLabelText } = render(ChargeLimitCard, {
      props: { limit: { type: 'energy', value: 10000 }, summary: '10 kWh', onclear },
    })
    expect(getByText('10 kWh')).toBeInTheDocument()
    await fireEvent.click(getByLabelText('dashboard.limit.clear'))
    expect(onclear).toHaveBeenCalledOnce()
  })
})
