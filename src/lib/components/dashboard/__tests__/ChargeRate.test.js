import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ChargeRate from '../ChargeRate.svelte'

describe('ChargeRate', () => {
  it('shows the current amps value', () => {
    const { getByText } = render(ChargeRate, { props: { amps: 24, max: 48 } })
    expect(getByText('24 A')).toBeInTheDocument()
  })
  it('calls onchange with the new amps', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(ChargeRate, { props: { amps: 24, max: 48, onchange } })
    const input = getByRole('slider')
    input.value = '32'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(32)
  })
})
