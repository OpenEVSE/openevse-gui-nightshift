import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../api/httpAPI.js'
import { uistates_store } from '../../../stores/uistates.js'
import HealthTab from '../HealthTab.svelte'

describe('HealthTab', () => {
  beforeEach(() => {
    uistates_store.resetAlertBox()
  })

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

  it('resets relay health via the typed /relay/reset endpoint when the reset button is clicked', async () => {
    httpAPI.mockClear()
    const relay = [{ key: 'life_pct', value: 100, severity: 'ok' }]
    const { getByText } = render(HealthTab, { props: { data: { errors: [], infos: [] }, relay } })
    await fireEvent.click(getByText('monitoring.health.relay.reset_button'))
    await vi.waitFor(() => {
      const call = httpAPI.mock.calls.find(
        ([m, u]) => m === 'GET' && String(u).includes('/relay/reset'),
      )
      expect(call).toBeTruthy()
    })
  })

  it('renders the recovery button alongside the reset button when relay data is present', () => {
    const relay = [{ key: 'life_pct', value: 100, severity: 'ok' }]
    const { getByText } = render(HealthTab, { props: { data: { errors: [], infos: [] }, relay } })
    expect(getByText('monitoring.health.relay.recovery_button')).toBeInTheDocument()
  })

  it('runs stuck-relay recovery via the typed /relay/recovery endpoint when its button is clicked', async () => {
    httpAPI.mockClear()
    const relay = [{ key: 'life_pct', value: 100, severity: 'ok' }]
    const { getByText } = render(HealthTab, { props: { data: { errors: [], infos: [] }, relay } })
    await fireEvent.click(getByText('monitoring.health.relay.recovery_button'))
    await vi.waitFor(() => {
      const call = httpAPI.mock.calls.find(
        ([m, u]) => m === 'GET' && String(u).includes('/relay/recovery'),
      )
      expect(call).toBeTruthy()
    })
  })

  it('shows the recovery-specific error alert when the recovery request is refused', async () => {
    httpAPI.mockImplementationOnce(() => Promise.resolve({ msg: 'error' }))
    const relay = [{ key: 'life_pct', value: 100, severity: 'ok' }]
    const { getByText } = render(HealthTab, { props: { data: { errors: [], infos: [] }, relay } })
    await fireEvent.click(getByText('monitoring.health.relay.recovery_button'))
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
      expect(get(uistates_store).alertbox.title).toBe('monitoring.health.relay.recovery_failed_title')
    })
  })
})
