import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) =>
    opts?.values ? k + ':' + JSON.stringify(opts.values) : k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ChargingHero from '../ChargingHero.svelte'

const base = {
  kw: '3.2', soc: 74, target: 80, hasSoc: true,
  mode: 0, modeLocked: false, modeLockLabel: '',
  amps: 32, maxAmps: 48, rateClaimedBy: '', rateNonce: 0,
  samples: [], voltage: 240, sessionElapsed: 600, chartError: false,
  modeDisabled: false, rateDisabled: false,
}

describe('ChargingHero', () => {
  it('shows the live kW value and KW label', () => {
    const { getByText } = render(ChargingHero, { props: { ...base } })
    expect(getByText('3.2')).toBeInTheDocument()
    expect(getByText('KW')).toBeInTheDocument()
  })

  it('shows the SOC readout with the target when SOC is present', () => {
    const { getByText } = render(ChargingHero, { props: { ...base } })
    expect(getByText('74')).toBeInTheDocument()
    expect(getByText('dashboard.session.soc_target:{"target":80}')).toBeInTheDocument()
  })

  it('omits the SOC readout when no vehicle data', () => {
    const { queryByText } = render(ChargingHero, { props: { ...base, hasSoc: false, soc: null } })
    expect(queryByText('dashboard.session.soc_target:{"target":80}')).not.toBeInTheDocument()
  })

  it('renders the chart (collecting placeholder) when there is no error', async () => {
    const { getByText } = render(ChargingHero, { props: { ...base } })
    // SessionChart is now lazy (SessionChartLazy); wait for the dynamic import
    // to resolve before asserting chart content.
    await vi.dynamicImportSettled()
    expect(getByText('dashboard.session.collecting')).toBeInTheDocument()
  })

  it('hides the chart entirely on an energy fetch error', () => {
    const { queryByText } = render(ChargingHero, { props: { ...base, chartError: true } })
    expect(queryByText('dashboard.session.collecting')).not.toBeInTheDocument()
    // readout still present
    expect(queryByText('3.2')).toBeInTheDocument()
  })

  it('omits the target sublabel when target is null', () => {
    const { queryByText } = render(ChargingHero, { props: { ...base, target: null } })
    expect(queryByText(/null/)).not.toBeInTheDocument()
  })

  it('rounds a fractional SOC for display', () => {
    const { getByText } = render(ChargingHero, { props: { ...base, soc: 74.6 } })
    expect(getByText('75')).toBeInTheDocument()
  })
})
