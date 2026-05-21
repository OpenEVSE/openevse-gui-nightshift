import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import SegmentedControl from '../SegmentedControl.svelte'

const opts = [
  { value: 0, label: 'Auto' },
  { value: 1, label: 'On' },
  { value: 2, label: 'Off', disabled: true },
]

describe('SegmentedControl', () => {
  it('marks the selected option with aria-pressed', () => {
    const { getByText } = render(SegmentedControl, { props: { options: opts, value: 1 } })
    expect(getByText('On').getAttribute('aria-pressed')).toBe('true')
    expect(getByText('Auto').getAttribute('aria-pressed')).toBe('false')
  })
  it('calls onchange with the value when a segment is clicked', async () => {
    const onchange = vi.fn()
    const { getByText } = render(SegmentedControl, { props: { options: opts, value: 0, onchange } })
    await fireEvent.click(getByText('On'))
    expect(onchange).toHaveBeenCalledWith(1)
  })
  it('does not fire onchange for a disabled option', async () => {
    const onchange = vi.fn()
    const { getByText } = render(SegmentedControl, { props: { options: opts, value: 0, onchange } })
    await fireEvent.click(getByText('Off'))
    expect(onchange).not.toHaveBeenCalled()
  })
})
