import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import Slider from '../Slider.svelte'

describe('Slider', () => {
  it('renders a range input with min/max/value', () => {
    const { getByRole } = render(Slider, { props: { min: 6, max: 48, value: 24 } })
    const input = getByRole('slider')
    expect(input.min).toBe('6')
    expect(input.max).toBe('48')
    expect(input.value).toBe('24')
  })
  it('calls oninput with the numeric value while dragging', async () => {
    const oninput = vi.fn()
    const { getByRole } = render(Slider, { props: { min: 6, max: 48, value: 24, oninput } })
    const input = getByRole('slider')
    input.value = '30'
    await fireEvent.input(input)
    expect(oninput).toHaveBeenCalledWith(30)
  })
  it('calls onchange with the numeric value on change', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(Slider, { props: { min: 6, max: 48, value: 24, onchange } })
    const input = getByRole('slider')
    input.value = '32'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(32)
  })
})
