import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import Select from '../Select.svelte'

const items = [
  { value: 'time', label: 'Time' },
  { value: 'energy', label: 'Energy' },
]

describe('Select', () => {
  it('renders the options and current value', () => {
    const { getByRole } = render(Select, { props: { options: items, value: 'energy' } })
    expect(getByRole('combobox').value).toBe('energy')
  })
  it('calls onchange with the selected value', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(Select, { props: { options: items, value: 'time', onchange } })
    const sel = getByRole('combobox')
    sel.value = 'energy'
    await fireEvent.change(sel)
    expect(onchange).toHaveBeenCalledWith('energy')
  })
})
