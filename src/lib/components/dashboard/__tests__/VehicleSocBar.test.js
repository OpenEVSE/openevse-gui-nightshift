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
  it('shows the current SOC percentage', () => {
    const { getByText } = render(VehicleSocBar, { props: { ...base } })
    expect(getByText('74%')).toBeInTheDocument()
  })

  it('emits onchange with the committed target on change', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(VehicleSocBar, { props: { ...base, onchange } })
    const input = getByRole('slider')
    input.value = '65'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(65)
  })

  it('labels the draggable knob as the EVSE limit', () => {
    const { getByText } = render(VehicleSocBar, { props: { ...base } })
    expect(getByText('dashboard.vehicle.evse_limit')).toBeInTheDocument()
  })

  it('colours the EVSE-limit marker red only when above the vehicle limit', () => {
    const above = render(VehicleSocBar, { props: { soc: 74, vehicleLimit: 75, target: 80 } })
    expect(above.getByText('dashboard.vehicle.evse_limit').className).toContain('text-error')
    cleanup()

    const below = render(VehicleSocBar, { props: { soc: 74, vehicleLimit: 90, target: 80 } })
    expect(below.getByText('dashboard.vehicle.evse_limit').className).not.toContain('text-error')
  })

  it('has no clear button — clearing is done by dragging to the vehicle limit', () => {
    const { queryByLabelText } = render(VehicleSocBar, { props: { ...base } })
    expect(queryByLabelText('dashboard.vehicle.clear')).not.toBeInTheDocument()
  })

  it('omits the vehicle-limit marker when the limit is unknown', () => {
    const { queryByText } = render(VehicleSocBar, { props: { soc: 74, vehicleLimit: null, target: 80 } })
    expect(queryByText('dashboard.vehicle.vehicle_limit')).not.toBeInTheDocument()
  })
})
