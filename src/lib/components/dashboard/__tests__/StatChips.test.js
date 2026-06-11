import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import StatChips from '../StatChips.svelte'

const live = {
  sessionKwh: '12.30', elapsed: '01:42:09', currentA: '32.0',
  voltage: 240, tempC: '42.7', pilotA: 32,
}
const summary = { todayKwh: '3.2', totalKwh: '7523' }

describe('StatChips', () => {
  it('shows live chips when charging', () => {
    const { getByText } = render(StatChips, { props: { charging: true, live, summary } })
    expect(getByText('12.30')).toBeInTheDocument()
    expect(getByText('01:42:09')).toBeInTheDocument()
  })
  it('shows the charge ETA under the elapsed chip when present', () => {
    const { getByText } = render(StatChips, {
      props: { charging: true, live: { ...live, toFull: '1h 20m' }, summary },
    })
    expect(getByText('dashboard.vehicle.to_full')).toBeInTheDocument()
  })
  it('omits the charge ETA when the topic is absent', () => {
    const { queryByText } = render(StatChips, {
      props: { charging: true, live: { ...live, toFull: '' }, summary },
    })
    expect(queryByText('dashboard.vehicle.to_full')).toBeNull()
  })
  it('shows the today/total summary when not charging', () => {
    const { getByText } = render(StatChips, { props: { charging: false, live, summary } })
    expect(getByText('3.2')).toBeInTheDocument()
    expect(getByText('7523')).toBeInTheDocument()
  })
  it('renders the sensor trio as desktop pills and a mobile row', () => {
    const { container } = render(StatChips, { props: { charging: true, live, summary } })
    // mobile compact row keeps its rule but hides at lg
    const row = container.querySelector('[class*="border-b"]')
    expect(row.className).toContain('lg:hidden')
    // desktop pill grid (hidden on mobile) carries the three sensor chips
    const pills = container.querySelector('[class*="lg:grid-cols-3"]')
    expect(pills).toBeTruthy()
    expect(pills.className).toContain('hidden')
    expect(pills.textContent).toContain('240 V')
    expect(pills.textContent).toContain('32 A')
  })
})
