import { describe, it, expect } from 'vitest'
import { defaultCurrent } from '../defaultCurrent.js'

describe('defaultCurrent', () => {
  it('reads default_current', () => {
    expect(defaultCurrent({ default_current: 16 })).toBe(16)
  })

  it('falls back to max_current_soft from older firmware', () => {
    expect(defaultCurrent({ max_current_soft: 32 })).toBe(32)
  })

  it('prefers default_current when both are present', () => {
    expect(defaultCurrent({ default_current: 16, max_current_soft: 32 })).toBe(16)
  })

  it('returns the fallback when neither is present', () => {
    expect(defaultCurrent({}, 6)).toBe(6)
    expect(defaultCurrent(undefined, null)).toBeNull()
    expect(defaultCurrent(null)).toBeUndefined()
  })

  it('keeps a 0 rather than falling through', () => {
    expect(defaultCurrent({ default_current: 0, max_current_soft: 32 }, 6)).toBe(0)
  })
})
