import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import LogList from '../LogList.svelte'

const rows = [
  { stateIcon: 'mdi:flash', stateTone: 'charging', stateDesc: 'Charging',
    typeIcon: 'mdi:information-outline', typeTone: 'info', typeLabel: 'Information',
    timeText: '05/21 18:30', energyKwh: 7.4, tempC: 28.5 },
  { stateIcon: 'mdi:shield-alert', stateTone: 'error', stateDesc: 'Stuck Relay',
    typeIcon: 'mdi:alert', typeTone: 'error', typeLabel: 'Warning',
    timeText: '05/20 22:05', energyKwh: 0, tempC: 41.2 },
]

describe('LogList', () => {
  it('shows the empty state when there are no rows', () => {
    const { getByText } = render(LogList, { props: { rows: [] } })
    expect(getByText('history.empty')).toBeInTheDocument()
  })
  it('renders one entry per row', () => {
    const { getByText } = render(LogList, { props: { rows } })
    expect(getByText('Charging')).toBeInTheDocument()
    expect(getByText('Stuck Relay')).toBeInTheDocument()
  })
})
