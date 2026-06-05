import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import VehicleSocBar from '../VehicleSocBar.svelte'

const base = { soc: 74, vehicleLimit: 90, target: 80, charging: true }

describe('VehicleSocBar', () => {
  it('shows the current SOC as a percent in percent mode', () => {
    const { getByText } = render(VehicleSocBar, { props: { ...base } })
    expect(getByText('74%')).toBeInTheDocument()
  })

  it('shimmers the fill only while charging', () => {
    const charging = render(VehicleSocBar, { props: { ...base, charging: true } })
    expect(charging.container.querySelector('.soc-shimmer')).toBeTruthy()
    cleanup()
    const idle = render(VehicleSocBar, { props: { ...base, charging: false } })
    expect(idle.container.querySelector('.soc-shimmer')).toBeFalsy()
  })

  it('emits onchange with the committed percent on change', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(VehicleSocBar, { props: { ...base, onchange } })
    const input = getByRole('slider')
    input.value = '65'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(65)
  })

  it('labels the SOC in range units when in range mode', () => {
    const { getByText } = render(VehicleSocBar, {
      props: { ...base, unit: 'range', estMaxRange: 278 },
    })
    expect(getByText('206 units.km')).toBeInTheDocument()
  })

  it('shows the unit toggle only when estMaxRange is known', () => {
    const withRange = render(VehicleSocBar, { props: { ...base, estMaxRange: 278 } })
    expect(withRange.getByRole('group', { name: 'dashboard.vehicle.unit_aria' })).toBeInTheDocument()
    cleanup()
    const noRange = render(VehicleSocBar, { props: { ...base } })
    expect(noRange.queryByRole('group', { name: 'dashboard.vehicle.unit_aria' })).not.toBeInTheDocument()
  })

  it('emits onunit when a unit button is clicked', async () => {
    const onunit = vi.fn()
    const { getByRole } = render(VehicleSocBar, {
      props: { ...base, estMaxRange: 278, onunit },
    })
    // the range-unit button's accessible name is its visible text (units.km under the i18n mock)
    await fireEvent.click(getByRole('button', { name: 'units.km' }))
    expect(onunit).toHaveBeenCalledWith('range')
  })

  it('colours the EVSE-limit marker red only when above the vehicle limit', () => {
    const above = render(VehicleSocBar, { props: { soc: 74, vehicleLimit: 75, target: 80 } })
    expect(above.getByText('dashboard.vehicle.evse_limit').className).toContain('text-error')
    cleanup()
    const below = render(VehicleSocBar, { props: { soc: 74, vehicleLimit: 90, target: 80 } })
    expect(below.getByText('dashboard.vehicle.evse_limit').className).not.toContain('text-error')
  })

  it('snaps the knob back to the vehicle limit when released above it', async () => {
    const { getByRole } = render(VehicleSocBar, { props: { soc: 40, vehicleLimit: 75, target: 75 } })
    const input = getByRole('slider')
    input.value = '88'
    await fireEvent.input(input)
    await fireEvent.change(input)
    expect(input.value).toBe('75')
  })

  it('renders the vehicle-limit hover tooltip when the limit is known', () => {
    const { getByText } = render(VehicleSocBar, { props: { soc: 74, vehicleLimit: 90, target: 80 } })
    expect(getByText('dashboard.vehicle.vehicle_limit_tip')).toBeInTheDocument()
  })

  it('omits the vehicle-limit marker when the limit is unknown', () => {
    const { queryByText } = render(VehicleSocBar, { props: { soc: 74, vehicleLimit: null, target: 80 } })
    expect(queryByText('dashboard.vehicle.vehicle_limit_tip')).not.toBeInTheDocument()
  })

  it('shows current → target progress in percent mode', () => {
    const { getByText } = render(VehicleSocBar, {
      props: { soc: 74, vehicleLimit: 90, target: 80, charging: false },
    })
    expect(getByText('74% → 80%')).toBeInTheDocument()
  })

  it('shows current → target progress in range units', () => {
    const { getByText } = render(VehicleSocBar, {
      props: { soc: 74, vehicleLimit: 90, target: 80, range: 206, unit: 'range', estMaxRange: 278, charging: false },
    })
    // current uses the reported range (206); target ≈ 80% of estMaxRange
    expect(getByText(/^206 → \d+ units\.km$/)).toBeInTheDocument()
  })

  it('collapses to a single value (no arrow) when SOC has reached the target', () => {
    const { queryByText } = render(VehicleSocBar, {
      props: { soc: 85, vehicleLimit: 90, target: 80, charging: false },
    })
    // soc (85) is at/above the effective target -> no "→" anywhere
    expect(queryByText(/→/)).not.toBeInTheDocument()
  })
})
