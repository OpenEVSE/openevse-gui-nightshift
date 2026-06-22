import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import RuleCard from '../RuleCard.svelte'

const rule = {
  id: 'r_1', action: 'eco_divert', days: ['monday'],
  startTime: '08:00', stopTime: '10:00', _startEventId: 1,
}

describe('RuleCard', () => {
  it('shows the Active badge when the rule is active', () => {
    const { getByText } = render(RuleCard, { props: { rule, active: true } })
    expect(getByText('charge_manager.active')).toBeInTheDocument()
  })
  it('hides the Active badge when the rule is not active', () => {
    const { queryByText } = render(RuleCard, { props: { rule, active: false } })
    expect(queryByText('charge_manager.active')).not.toBeInTheDocument()
  })
})
