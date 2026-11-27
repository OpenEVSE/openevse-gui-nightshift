import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import RuleModal from '../RuleModal.svelte'

const rebootRule = {
  id: 'r_7', alwaysOn: false, action: 'reboot',
  days: ['sunday'], startTime: '03:00', stopTime: null,
  chargeCurrent: null, limit: null, _startEventId: 7, _stopEventId: null,
}

const stopCheckbox = (container) =>
  [...container.querySelectorAll('input[type="checkbox"]')]
    .find((el) => el.closest('label')?.textContent.includes('charge_manager.rule_set_stop_time'))

const rebootOption = (container) => container.querySelector('option[value="reboot"]')

describe('RuleModal — Reboot Station', () => {
  it('greys out the stop time and hides the limit for a reboot rule', () => {
    const { container, getByText, queryByText } = render(RuleModal, {
      props: { open: true, rule: rebootRule, rebootAvailable: true },
    })
    expect(stopCheckbox(container).disabled).toBe(true)
    expect(stopCheckbox(container).closest('div').className).toContain('opacity-40')
    expect(getByText('charge_manager.rule_reboot_note')).toBeInTheDocument()
    expect(queryByText('charge_manager.rule_limit')).not.toBeInTheDocument()
  })

  it('saves a reboot rule without a stop time even if one was set before', async () => {
    const onsave = vi.fn()
    const { getByText } = render(RuleModal, {
      props: { open: true, rule: { ...rebootRule, stopTime: '05:00' }, rebootAvailable: true, onsave },
    })
    await fireEvent.click(getByText('charge_manager.rule_save'))
    expect(onsave).toHaveBeenCalledTimes(1)
    expect(onsave.mock.calls[0][0]).toMatchObject({ action: 'reboot', startTime: '03:00', stopTime: null, limit: null })
  })

  it('offers Reboot Station only when the firmware supports it', () => {
    const newRule = { ...rebootRule, action: 'charge', _startEventId: null }
    const supported = render(RuleModal, { props: { open: true, rule: newRule, rebootAvailable: true } })
    expect(rebootOption(supported.container).disabled).toBe(false)
    supported.unmount()

    const unsupported = render(RuleModal, { props: { open: true, rule: newRule, rebootAvailable: false } })
    expect(rebootOption(unsupported.container).disabled).toBe(true)
  })

  it('leaves the stop time usable for other actions', () => {
    const { container } = render(RuleModal, {
      props: { open: true, rule: { ...rebootRule, action: 'charge' }, rebootAvailable: true },
    })
    expect(stopCheckbox(container).disabled).toBe(false)
  })
})
