import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import SafetyTab from '../SafetyTab.svelte'

describe('SafetyTab', () => {
  it('renders the error count rows and the info row', () => {
    const data = {
      errors: [
        { key: 'gfci', count: 0, severity: 'ok' },
        { key: 'noground', count: 5, severity: 'error' },
        { key: 'stuck', count: 0, severity: 'ok' },
      ],
      infos: [{ key: 'switches', count: 19, severity: 'ok' }],
    }
    const { getByText } = render(SafetyTab, { props: { data } })
    expect(getByText('monitoring.safety.gfci')).toBeInTheDocument()
    expect(getByText('5')).toBeInTheDocument()
    expect(getByText('19')).toBeInTheDocument()
  })
  it('renders a fault row with the localised state description when faulted', () => {
    const data = {
      errors: [
        { key: 'fault', state: 8, severity: 'error' },
        { key: 'gfci', count: 0, severity: 'ok' },
        { key: 'noground', count: 0, severity: 'ok' },
        { key: 'stuck', count: 0, severity: 'ok' },
      ],
      infos: [{ key: 'switches', count: 0, severity: 'ok' }],
    }
    const { getByText } = render(SafetyTab, { props: { data } })
    expect(getByText('monitoring.safety.fault')).toBeInTheDocument()
  })
  it('shows the exact JuiceBox fault label from wr when comms are live', () => {
    const data = {
      errors: [
        { key: 'fault', state: 8, wr: '005:Pilot Signal Gen Fail:', comms_online: true, severity: 'error' },
      ],
      infos: [],
    }
    const { getByText } = render(SafetyTab, { props: { data } })
    // state 8 alone would be the generic "Stuck Relay"; wr 005 overrides it.
    expect(getByText('jb-fault.005')).toBeInTheDocument()
  })
})
