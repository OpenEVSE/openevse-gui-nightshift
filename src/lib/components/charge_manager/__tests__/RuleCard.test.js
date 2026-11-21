import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

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
  it('shows a current chip when the timer sets a charge current', () => {
    const { getByText } = render(RuleCard, {
      props: { rule: { ...rule, action: 'charge', chargeCurrent: 16 } },
    })
    expect(getByText('16 A')).toBeInTheDocument()
  })
  it('omits the current chip when no charge current is set', () => {
    const { queryByText } = render(RuleCard, {
      props: { rule: { ...rule, action: 'charge', chargeCurrent: null } },
    })
    expect(queryByText('16 A')).not.toBeInTheDocument()
  })

  it('offers no on/off switch when the firmware cannot disable rules', () => {
    const { queryByRole } = render(RuleCard, { props: { rule } })
    expect(queryByRole('switch')).not.toBeInTheDocument()
  })
  it('shows an on switch for an enabled rule and reports the change', async () => {
    const onenabledchange = vi.fn()
    const { getByRole } = render(RuleCard, {
      props: { rule: { ...rule, enabled: true, canDisable: true }, onenabledchange },
    })
    const sw = getByRole('switch', { name: 'charge_manager.rule_enabled' })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    await fireEvent.click(sw)
    expect(onenabledchange).toHaveBeenCalledWith(false)
  })
  it('shows Off instead of Active for a switched-off rule', () => {
    const { getByText, queryByText, getByRole } = render(RuleCard, {
      props: { rule: { ...rule, enabled: false, canDisable: true }, active: true },
    })
    expect(getByText('charge_manager.rule_off')).toBeInTheDocument()
    expect(queryByText('charge_manager.active')).not.toBeInTheDocument()
    expect(getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })
})
