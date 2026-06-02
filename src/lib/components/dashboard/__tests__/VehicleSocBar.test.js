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
    expect(withRange.getAllByLabelText('dashboard.vehicle.unit_aria')[0]).toBeInTheDocument()
    cleanup()
    const noRange = render(VehicleSocBar, { props: { ...base } })
    expect(noRange.queryByLabelText('dashboard.vehicle.unit_aria')).not.toBeInTheDocument()
  })

  it('emits onunit when a unit button is clicked', async () => {
    const onunit = vi.fn()
    const { getAllByLabelText } = render(VehicleSocBar, {
      props: { ...base, estMaxRange: 278, onunit },
    })
    const buttons = getAllByLabelText('dashboard.vehicle.unit_aria')
    await fireEvent.click(buttons[1])
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

  it('omits the vehicle-limit marker when the limit is unknown', () => {
    const { queryByText } = render(VehicleSocBar, { props: { soc: 74, vehicleLimit: null, target: 80 } })
    expect(queryByText('dashboard.vehicle.vehicle_limit')).not.toBeInTheDocument()
  })
})
