import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import TimerList from '../TimerList.svelte'

const timers = [
  { id: 1, state: 'active', time: '07:00', days: ['monday'] },
  { id: 2, state: 'disabled', time: '22:30', days: ['saturday', 'sunday'] },
]

describe('TimerList', () => {
  it('shows the empty state when there are no timers', () => {
    const { getByText } = render(TimerList, { props: { timers: [] } })
    expect(getByText('schedule.empty')).toBeInTheDocument()
  })
  it('renders one row per timer', () => {
    const { getAllByLabelText } = render(TimerList, { props: { timers } })
    expect(getAllByLabelText('schedule.delete')).toHaveLength(2)
  })
})
