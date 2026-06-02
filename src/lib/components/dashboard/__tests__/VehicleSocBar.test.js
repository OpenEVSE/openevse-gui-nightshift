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

  it('shows the cap note only when the target is above the vehicle limit', async () => {
    const capped = render(VehicleSocBar, { props: { soc: 74, vehicleLimit: 75, target: 80 } })
    expect(capped.getByText('dashboard.vehicle.cap_note')).toBeInTheDocument()
    cleanup()

    const normal = render(VehicleSocBar, { props: { soc: 74, vehicleLimit: 90, target: 80 } })
    expect(normal.queryByText('dashboard.vehicle.cap_note')).not.toBeInTheDocument()
  })

  it('shows the clear control and calls onclear only when a limit is active', async () => {
    const onclear = vi.fn()
    const active = render(VehicleSocBar, { props: { ...base, limitActive: true, onclear } })
    await fireEvent.click(active.getByLabelText('dashboard.vehicle.clear'))
    expect(onclear).toHaveBeenCalledOnce()
    cleanup()

    const inactive = render(VehicleSocBar, { props: { ...base, limitActive: false } })
    expect(inactive.queryByLabelText('dashboard.vehicle.clear')).not.toBeInTheDocument()
  })

  it('omits the vehicle-limit marker when the limit is unknown', () => {
    const { queryByText } = render(VehicleSocBar, { props: { soc: 74, vehicleLimit: null, target: 80 } })
    expect(queryByText('dashboard.vehicle.vehicle_limit')).not.toBeInTheDocument()
  })
})
