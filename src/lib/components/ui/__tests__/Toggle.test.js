import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import Toggle from '../Toggle.svelte'

describe('Toggle', () => {
  it('reflects checked state via aria-checked', () => {
    const { getByRole } = render(Toggle, { props: { checked: true, label: 'Eco' } })
    expect(getByRole('switch').getAttribute('aria-checked')).toBe('true')
  })
  it('calls onchange with the toggled value', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(Toggle, { props: { checked: false, label: 'Eco', onchange } })
    await fireEvent.click(getByRole('switch'))
    expect(onchange).toHaveBeenCalledWith(true)
  })
})
