import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import LimitSliderBar from '../LimitSliderBar.svelte'

describe('LimitSliderBar', () => {
  it('commits a time limit in minutes', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(LimitSliderBar, { props: { kind: 'time', value: 0, onchange } })
    const input = getByRole('slider', { name: 'dashboard.limit.type_time' })
    // The input runs in tick space: tick 8 on the 15-min segment = 120 min.
    input.value = '8'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(120)
  })

  it('time ticks coarsen along the 24 h scale (15 min / 30 min / 1 h segments)', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(LimitSliderBar, { props: { kind: 'time', value: 0, onchange } })
    const input = getByRole('slider', { name: 'dashboard.limit.type_time' })
    expect(input.max).toBe('40') // 17 + 8 + 16 stops
    input.value = '17' // first stop past 4 h → 4:30
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(270)
    input.value = '40' // last stop → 24 h
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(1440)
  })

  it('commits an energy limit converted from kWh to Wh', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(LimitSliderBar, { props: { kind: 'energy', value: 0, onchange } })
    const input = getByRole('slider', { name: 'dashboard.limit.type_energy' })
    input.value = '10'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(10000)
  })

  it('drag to zero emits 0 (clear) when a limit is active', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(LimitSliderBar, { props: { kind: 'energy', value: 10000, onchange } })
    const input = getByRole('slider', { name: 'dashboard.limit.type_energy' })
    input.value = '0'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(0)
  })

  it('suppresses no-change commits (idle editor cannot clear another limit)', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(LimitSliderBar, { props: { kind: 'time', value: 0, onchange } })
    const input = getByRole('slider', { name: 'dashboard.limit.type_time' })
    input.value = '0'
    await fireEvent.change(input)
    expect(onchange).not.toHaveBeenCalled()
  })

  it('shows the drag hint when no limit is set and the remaining when active', () => {
    const idle = render(LimitSliderBar, { props: { kind: 'time', value: 0 } })
    expect(idle.getByText('dashboard.limit.drag_to_set')).toBeInTheDocument()
    const active = render(LimitSliderBar, {
      props: { kind: 'time', value: 120, progress: 2880, charging: true },
    })
    // 120 min limit, 2880 s (48 min) elapsed → 1h 12m left
    expect(active.getByText(/1h 12m/)).toBeInTheDocument()
  })

  it('caps the progress fill at the knob and only fills while a limit is active', () => {
    const over = render(LimitSliderBar, {
      props: { kind: 'energy', value: 5000, progress: 9000, charging: true },
    })
    const fill = over.container.querySelector('[data-fill]')
    // 5 kWh limit = knob at 5% of the 100 kWh track; over-delivered progress
    // caps the fill AT the knob, never past it.
    expect(fill.style.width).toBe('5%')
    // On the time scale the fill is a tick fraction too: a 1 h limit sits at
    // tick 4 of 40 (10%), and 30 min of progress fills half-way to it (5%).
    const time = render(LimitSliderBar, {
      props: { kind: 'time', value: 60, progress: 1800, charging: true },
    })
    expect(time.container.querySelector('[data-fill]').style.width).toBe('5%')
    const none = render(LimitSliderBar, { props: { kind: 'energy', value: 0, progress: 9000 } })
    expect(none.container.querySelector('[data-fill]').style.width).toBe('0%')
  })

  it('disables the input when disabled (system limit)', () => {
    const { getByRole } = render(LimitSliderBar, {
      props: { kind: 'time', value: 120, disabled: true },
    })
    expect(getByRole('slider', { name: 'dashboard.limit.type_time' })).toBeDisabled()
  })

  it('clears a sub-step limit (displays as 0 but is active)', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(LimitSliderBar, { props: { kind: 'energy', value: 400, onchange } })
    const input = getByRole('slider', { name: 'dashboard.limit.type_energy' })
    input.value = '0'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(0)
  })

  it('renders no NaN fill for a sub-step limit', () => {
    const { container } = render(LimitSliderBar, { props: { kind: 'energy', value: 400, progress: 0 } })
    expect(container.querySelector('[data-fill]').style.width).toBe('0%')
  })

  it('honours a configurable energy max (narrower track = finer steps)', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(LimitSliderBar, {
      props: { kind: 'energy', value: 0, maxEnergyKwh: 40, onchange },
    })
    const input = getByRole('slider', { name: 'dashboard.limit.type_energy' })
    // 40 kWh max → ticks 0..40.
    expect(input.max).toBe('40')
    // A 10 kWh commit still converts to Wh.
    input.value = '10'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(10000)
    // Fill for a 10 kWh limit is now a quarter of the track, not a tenth.
    const active = render(LimitSliderBar, {
      props: { kind: 'energy', value: 10000, progress: 10000, maxEnergyKwh: 40, charging: true },
    })
    expect(active.container.querySelector('[data-fill]').style.width).toBe('25%')
  })

  it('clamps the knob for an energy limit above the configured max', () => {
    // A 60 kWh system limit on a 40 kWh track pins the knob to the rail.
    const { container } = render(LimitSliderBar, {
      props: { kind: 'energy', value: 60000, maxEnergyKwh: 40 },
    })
    expect(container.querySelector('[data-knob]').style.left).toBe('100%')
  })

  it('keeps the stem inside the narrow value pill at the rails (SOC-bar pillShift, clamped tighter)', () => {
    const zero = render(LimitSliderBar, { props: { kind: 'time', value: 0 } })
    expect(zero.container.querySelector('[data-knob]').style.left).toBe('0%') // pin spans the full track
    expect(zero.container.querySelector('[data-pill]').style.transform).toBe('translateX(-20%)')
    const full = render(LimitSliderBar, { props: { kind: 'time', value: 1440 } })
    expect(full.container.querySelector('[data-knob]').style.left).toBe('100%')
    expect(full.container.querySelector('[data-pill]').style.transform).toBe('translateX(-80%)')
  })
})
