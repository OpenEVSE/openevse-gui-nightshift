import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import RatePill from '../RatePill.svelte'

describe('RatePill', () => {
  it('shows the current amps', () => {
    const { getByText } = render(RatePill, { props: { amps: 32, max: 48 } })
    expect(getByText('32 A')).toBeInTheDocument()
  })

  it('opens the popover and emits onchange from the slider', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(RatePill, { props: { amps: 24, max: 48, onchange } })
    await fireEvent.click(getByRole('button', { name: 'dashboard.rate.aria' }))
    const slider = getByRole('slider', { name: 'dashboard.rate.aria' })
    slider.value = '20'
    await fireEvent.change(slider)
    expect(onchange).toHaveBeenCalledWith(20)
  })

  it('tracks the drag value live in the header before release', async () => {
    const { getByRole, getAllByText, queryByText } = render(RatePill, { props: { amps: 25, max: 32 } })
    await fireEvent.click(getByRole('button', { name: 'dashboard.rate.aria' }))
    const slider = getByRole('slider', { name: 'dashboard.rate.aria' })
    slider.value = '18'
    await fireEvent.input(slider) // drag, no release yet
    // both the popover header and the pill button follow the drag
    expect(getAllByText('18 A')).toHaveLength(2)
    expect(queryByText('25 A')).toBeNull()
  })

  it('does not open when disabled', async () => {
    const { getByRole, queryByRole } = render(RatePill, { props: { amps: 24, max: 48, disabled: true } })
    await fireEvent.click(getByRole('button', { name: 'dashboard.rate.aria' }))
    expect(queryByRole('slider')).not.toBeInTheDocument()
  })

  it('shows the claimed hint when claimedBy is set', async () => {
    const { getByRole, getByText } = render(RatePill, { props: { amps: 16, max: 48, claimedBy: 'solar' } })
    await fireEvent.click(getByRole('button', { name: 'dashboard.rate.aria' }))
    expect(getByText('dashboard.rate.claimed')).toBeInTheDocument()
  })
})
