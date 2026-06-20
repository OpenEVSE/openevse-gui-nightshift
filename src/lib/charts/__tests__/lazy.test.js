// src/lib/charts/__tests__/lazy.test.js
import { describe, it, expect } from 'vitest'
import { CHARTS_ENABLED } from '../lazy.js'

describe('CHARTS_ENABLED', () => {
  it('is true by default (VITE_CHARTS unset in test env)', () => {
    expect(CHARTS_ENABLED).toBe(true)
  })
})
