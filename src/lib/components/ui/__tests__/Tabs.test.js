import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import Tabs from '../Tabs.svelte'

const tabs = [
  { label: 'Data', alert: false },
  { label: 'Safety', alert: true },
  { label: 'Manager', alert: false },
]

describe('Tabs', () => {
  it('renders a tab per entry and marks the active one', () => {
    const { getAllByRole } = render(Tabs, { props: { tabs, active: 1 } })
    const els = getAllByRole('tab')
    expect(els).toHaveLength(3)
    expect(els[1].getAttribute('aria-selected')).toBe('true')
    expect(els[0].getAttribute('aria-selected')).toBe('false')
  })
  it('fires onchange with the clicked index', async () => {
    const onchange = vi.fn()
    const { getByText } = render(Tabs, { props: { tabs, active: 0, onchange } })
    await fireEvent.click(getByText('Manager'))
    expect(onchange).toHaveBeenCalledWith(2)
  })
  it('shows an alert dot only on tabs with alert set', () => {
    const { getAllByRole } = render(Tabs, { props: { tabs, active: 0 } })
    const els = getAllByRole('tab')
    expect(els[0].querySelector('span')).toBe(null)
    expect(els[1].querySelector('span')).not.toBe(null)
  })
})
