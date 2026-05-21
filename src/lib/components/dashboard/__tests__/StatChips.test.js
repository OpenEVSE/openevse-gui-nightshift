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
  it('shows the today/total summary when not charging', () => {
    const { getByText } = render(StatChips, { props: { charging: false, live, summary } })
    expect(getByText('3.2')).toBeInTheDocument()
    expect(getByText('7523')).toBeInTheDocument()
  })
})
