import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../api/httpAPI.js'
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

  it('resets the fault counters via $FC when the reset button is clicked', async () => {
    httpAPI.mockClear()
    const { getByText } = render(SafetyTab, { props: { data: { errors: [], infos: [] } } })
    await fireEvent.click(getByText('config.safety.reset_faults'))
    await vi.waitFor(() => {
      const call = httpAPI.mock.calls.find(
        ([m, u]) => m === 'GET' && String(u).includes('$FC'),
      )
      expect(call).toBeTruthy()
    })
  })
})
