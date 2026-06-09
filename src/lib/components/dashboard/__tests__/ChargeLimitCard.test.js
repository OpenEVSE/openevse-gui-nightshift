import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ChargeLimitCard from '../ChargeLimitCard.svelte'

const vehicle = { hasSoc: true, soc: 74, vehicleLimit: 90, target: 80, estMaxRange: 278 }

describe('ChargeLimitCard (pills)', () => {
  it('shows all four pills with vehicle data and a range estimate', () => {
    const { getByRole } = render(ChargeLimitCard, { props: { ...vehicle } })
    for (const k of ['type_soc', 'type_range', 'type_time', 'type_energy'])
      expect(getByRole('radio', { name: `dashboard.limit.${k}` })).toBeInTheDocument()
  })

  it('collapses to Time and Energy pills without vehicle data', () => {
    const { queryByRole, getByRole } = render(ChargeLimitCard, { props: { hasSoc: false } })
    expect(queryByRole('radio', { name: 'dashboard.limit.type_soc' })).not.toBeInTheDocument()
    expect(queryByRole('radio', { name: 'dashboard.limit.type_range' })).not.toBeInTheDocument()
    expect(getByRole('radio', { name: 'dashboard.limit.type_time' })).toBeInTheDocument()
    expect(getByRole('radio', { name: 'dashboard.limit.type_energy' })).toBeInTheDocument()
  })

  it('defaults to the SOC editor with a vehicle and the Time editor without', () => {
    const withCar = render(ChargeLimitCard, { props: { ...vehicle } })
    expect(withCar.getByRole('slider', { name: 'dashboard.vehicle.target_aria' })).toBeInTheDocument()
    const without = render(ChargeLimitCard, { props: { hasSoc: false } })
    expect(without.getByRole('slider', { name: 'dashboard.limit.type_time' })).toBeInTheDocument()
  })

  it('defaults to the active limit type and marks its pill', () => {
    const { getByRole } = render(ChargeLimitCard, {
      props: { ...vehicle, limit: { type: 'energy', value: 10000, auto_release: true } },
    })
    expect(getByRole('slider', { name: 'dashboard.limit.type_energy' })).toBeInTheDocument()
    expect(getByRole('radio', { name: 'dashboard.limit.type_energy' }).getAttribute('aria-checked')).toBe('true')
    expect(getByRole('radio', { name: 'dashboard.limit.type_energy' }).querySelector('[data-active-dot]')).toBeTruthy()
  })

  it('keeps the active dot visible while viewing another pill', async () => {
    const { getByRole } = render(ChargeLimitCard, {
      props: { ...vehicle, limit: { type: 'energy', value: 10000, auto_release: true } },
    })
    await fireEvent.click(getByRole('radio', { name: 'dashboard.limit.type_time' }))
    expect(getByRole('slider', { name: 'dashboard.limit.type_time' })).toBeInTheDocument()
    expect(getByRole('radio', { name: 'dashboard.limit.type_energy' }).querySelector('[data-active-dot]')).toBeTruthy()
  })

  it('forwards SOC/Range pill picks to onunit', async () => {
    const onunit = vi.fn()
    const { getByRole } = render(ChargeLimitCard, { props: { ...vehicle, onunit } })
    await fireEvent.click(getByRole('radio', { name: 'dashboard.limit.type_range' }))
    expect(onunit).toHaveBeenCalledWith('range')
    await fireEvent.click(getByRole('radio', { name: 'dashboard.limit.type_soc' }))
    expect(onunit).toHaveBeenCalledWith('percent')
  })

  it('emits onlimit with device units from the inline editors', async () => {
    const onlimit = vi.fn()
    const { getByRole } = render(ChargeLimitCard, { props: { hasSoc: false, onlimit } })
    const slider = getByRole('slider', { name: 'dashboard.limit.type_time' })
    slider.value = '120'
    await fireEvent.change(slider)
    expect(onlimit).toHaveBeenCalledWith({ type: 'time', value: 120 })
  })

  it('disables only the active system limit editor', async () => {
    const { getByRole } = render(ChargeLimitCard, {
      props: { hasSoc: false, limit: { type: 'time', value: 120, auto_release: false }, systemLimit: true },
    })
    expect(getByRole('slider', { name: 'dashboard.limit.type_time' })).toBeDisabled()
    await fireEvent.click(getByRole('radio', { name: 'dashboard.limit.type_energy' }))
    expect(getByRole('slider', { name: 'dashboard.limit.type_energy' })).not.toBeDisabled()
  })

  it('has no clear button, set button, or modal trigger', () => {
    const { queryByLabelText, queryByText } = render(ChargeLimitCard, {
      props: { ...vehicle, limit: { type: 'energy', value: 10000, auto_release: true } },
    })
    expect(queryByLabelText('dashboard.limit.clear')).not.toBeInTheDocument()
    expect(queryByText('dashboard.limit.set')).not.toBeInTheDocument()
  })
})
