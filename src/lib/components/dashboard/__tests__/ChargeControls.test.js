import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ChargeControls from '../ChargeControls.svelte'

const base = {
  segment: 'auto', divertEnabled: true,
  locked: false, lockLabel: '', disabled: false, boostEndsAt: null,
}

describe('ChargeControls', () => {
  it('renders four segments when divert is enabled', () => {
    const { getByText } = render(ChargeControls, { props: { ...base } })
    for (const label of ['dashboard.mode.off', 'dashboard.mode.auto', 'dashboard.eco', 'dashboard.mode.on'])
      expect(getByText(label)).toBeInTheDocument()
  })

  it('omits the eco segment when divert is disabled', () => {
    const { queryByText } = render(ChargeControls, { props: { ...base, divertEnabled: false } })
    expect(queryByText('dashboard.eco')).not.toBeInTheDocument()
  })

  it('marks the selected segment with aria-checked', () => {
    const { getByText } = render(ChargeControls, { props: { ...base, segment: 'eco' } })
    expect(getByText('dashboard.eco').getAttribute('aria-checked')).toBe('true')
    expect(getByText('dashboard.mode.auto').getAttribute('aria-checked')).toBe('false')
  })

  it('emits onsegment with the clicked segment key', async () => {
    const onsegment = vi.fn()
    const { getByText } = render(ChargeControls, { props: { ...base, onsegment } })
    await fireEvent.click(getByText('dashboard.mode.on'))
    expect(onsegment).toHaveBeenCalledWith('on')
  })

  it('shows the locked box and hides the segments when locked', () => {
    const { getByText, queryByText } = render(ChargeControls, {
      props: { ...base, locked: true, lockLabel: 'OCPP' },
    })
    expect(getByText('dashboard.controls.locked_by:{"owner":"OCPP"}')).toBeInTheDocument()
    expect(queryByText('dashboard.mode.auto')).not.toBeInTheDocument()
  })

  it('does not render a shaper toggle (it lives in Settings)', () => {
    const { queryByLabelText } = render(ChargeControls, { props: { ...base } })
    expect(queryByLabelText('dashboard.shaper')).not.toBeInTheDocument()
  })

  it('disables the segment buttons when disabled', () => {
    const { getByText } = render(ChargeControls, { props: { ...base, disabled: true } })
    expect(getByText('dashboard.mode.auto')).toBeDisabled()
  })
})
