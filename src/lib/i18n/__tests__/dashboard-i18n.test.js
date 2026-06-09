import { describe, it, expect } from 'vitest'
import en from '../en.json'

describe('dashboard i18n keys', () => {
  it('has the dashboard block', () => {
    expect(en.dashboard.status.charging).toBeTypeOf('string')
    expect(en.dashboard.ring.ready).toBeTypeOf('string')
    expect(en.dashboard.reason.off).toBeTypeOf('string')
    expect(en.dashboard.chips.current).toBeTypeOf('string')
    expect(en.dashboard.mode.auto).toBeTypeOf('string')
    expect(en.dashboard.limit.pills_aria).toBeTypeOf('string')
  })
})
