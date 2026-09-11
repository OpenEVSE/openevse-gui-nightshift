import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../api/httpAPI.js'
import HealthTab from '../HealthTab.svelte'

describe('HealthTab', () => {
  it('renders the error count rows and the info row', () => {
    const data = {
      errors: [
        { key: 'gfci', count: 0, severity: 'ok' },
        { key: 'noground', count: 5, severity: 'error' },
        { key: 'stuck', count: 0, severity: 'ok' },
      ],
      infos: [{ key: 'switches', count: 19, severity: 'ok' }],
    }
    const { getByText } = render(HealthTab, { props: { data } })
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
    const { getByText } = render(HealthTab, { props: { data } })
    expect(getByText('monitoring.safety.fault')).toBeInTheDocument()
  })

  it('resets the fault counters via $FC when the reset button is clicked', async () => {
    httpAPI.mockClear()
    const { getByText } = render(HealthTab, { props: { data: { errors: [], infos: [] } } })
    await fireEvent.click(getByText('config.safety.reset_faults'))
    await vi.waitFor(() => {
      const call = httpAPI.mock.calls.find(
        ([m, u]) => m === 'GET' && String(u).includes('$FC'),
      )
      expect(call).toBeTruthy()
    })
  })

  it('does not render the Relay Health section when relay data is absent', () => {
    const { queryByText } = render(HealthTab, { props: { data: { errors: [], infos: [] } } })
    expect(queryByText('monitoring.health.relay.title')).not.toBeInTheDocument()
  })

  it('renders the Relay Health section and its rows when relay data is present', () => {
    const relay = [
      { key: 'life_pct', value: 72, severity: 'ok' },
      { key: 'cold_open_count', value: 42, severity: 'ok' },
      { key: 'stuck_recovery_count', value: 2, severity: 'warning' },
    ]
    const { getByText } = render(HealthTab, { props: { data: { errors: [], infos: [] }, relay } })
    expect(getByText('monitoring.health.relay.title')).toBeInTheDocument()
    // svelte-i18n is mocked to an identity function above, so unit keys
    // render literally rather than as their translated symbol (e.g. "%")
    expect(getByText('72units.percent')).toBeInTheDocument()
    expect(getByText('42')).toBeInTheDocument()
    expect(getByText('monitoring.health.relay.reset_button')).toBeInTheDocument()
  })

  it('renders "not available" for null relay values', () => {
    const relay = [{ key: 'transit_baseline', value: null, severity: 'ok' }]
    const { getByText } = render(HealthTab, { props: { data: { errors: [], infos: [] }, relay } })
    expect(getByText('monitoring.health.relay.not_available')).toBeInTheDocument()
  })

  it('resets relay health via $FH when the reset button is clicked', async () => {
    httpAPI.mockClear()
    const relay = [{ key: 'life_pct', value: 100, severity: 'ok' }]
    const { getByText } = render(HealthTab, { props: { data: { errors: [], infos: [] }, relay } })
    await fireEvent.click(getByText('monitoring.health.relay.reset_button'))
    await vi.waitFor(() => {
      const call = httpAPI.mock.calls.find(
        ([m, u]) => m === 'GET' && String(u).includes('$FH'),
      )
      expect(call).toBeTruthy()
    })
  })
  it('groups both reset buttons in the Maintenance section at the bottom', () => {
    const relay = [{ key: 'life_pct', value: 100, severity: 'ok' }]
    const { getByText, container } = render(HealthTab, { props: { data: { errors: [], infos: [] }, relay } })
    const title = getByText('monitoring.health.maintenance.title')
    const section = title.parentElement
    expect(section).toContainElement(getByText('config.safety.reset_faults'))
    expect(section).toContainElement(getByText('monitoring.health.relay.reset_button'))
    expect(container.lastElementChild).toBe(section)
  })

  it('hides the relay reset button but keeps the fault reset when relay data is absent', () => {
    const { getByText, queryByText } = render(HealthTab, { props: { data: { errors: [], infos: [] } } })
    expect(getByText('monitoring.health.maintenance.title')).toBeInTheDocument()
    expect(getByText('config.safety.reset_faults')).toBeInTheDocument()
    expect(queryByText('monitoring.health.relay.reset_button')).not.toBeInTheDocument()
  })
})
