import { describe, it, expect } from 'vitest'
import { formatCost } from '../cost.js'

describe('formatCost', () => {
  it('returns null when the rate is zero or missing', () => {
    expect(formatCost(5, 0, '$')).toBeNull()
    expect(formatCost(5, undefined, '$')).toBeNull()
  })

  it('returns null for unusable inputs', () => {
    expect(formatCost(NaN, 0.3, '$')).toBeNull()
    expect(formatCost(-1, 0.3, '$')).toBeNull()
    expect(formatCost(5, -0.1, '$')).toBeNull()
  })

  it('multiplies kWh by rate and prefixes the symbol', () => {
    expect(formatCost(10, 0.231, '$')).toBe('$2.31')
    expect(formatCost(2.5, 0.4, '€')).toBe('€1.00')
  })

  it('always renders two decimal places', () => {
    expect(formatCost(1, 0.5, '$')).toBe('$0.50')
    expect(formatCost(0, 0.5, '$')).toBe('$0.00')
  })

  it('handles a missing symbol by prefixing nothing', () => {
    expect(formatCost(1, 0.5, undefined)).toBe('0.50')
  })
})
