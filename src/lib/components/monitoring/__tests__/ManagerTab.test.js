import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ManagerTab from '../ManagerTab.svelte'

describe('ManagerTab', () => {
  it('shows the empty state when there are no claims', () => {
    const { getByText } = render(ManagerTab, { props: { rows: [] } })
    expect(getByText('monitoring.manager.empty')).toBeInTheDocument()
  })
  it('renders a row per claim with property and value', () => {
    const rows = [
      { property: 'state', clientId: 65537, value: 'disabled' },
      { property: 'charge_current', clientId: 65537, value: 32 },
    ]
    const { getByText } = render(ManagerTab, { props: { rows } })
    expect(getByText('state')).toBeInTheDocument()
    expect(getByText('charge_current')).toBeInTheDocument()
    expect(getByText('32')).toBeInTheDocument()
  })
  it('shows a priority bubble with the claim priority', () => {
    const rows = [{ property: 'state', clientId: 65537, value: 'disabled', priority: 1000 }]
    const { getByText } = render(ManagerTab, { props: { rows } })
    expect(getByText('monitoring.manager.priority: 1000')).toBeInTheDocument()
  })
})
