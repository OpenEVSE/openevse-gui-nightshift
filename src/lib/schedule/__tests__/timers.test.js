import { describe, it, expect } from 'vitest'
import { DAYS, nextTimerId, daysToFlags, flagsToDays, hasAnyDay, formatDayChips } from '../timers.js'

describe('DAYS', () => {
  it('is the seven days, Monday-first', () => {
    expect(DAYS).toEqual(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'])
  })
})

describe('nextTimerId', () => {
  it('returns 1 for an empty or missing list', () => {
    expect(nextTimerId([])).toBe(1)
    expect(nextTimerId(undefined)).toBe(1)
  })
  it('returns highest id + 1, regardless of order or gaps', () => {
    expect(nextTimerId([{ id: 1 }, { id: 5 }, { id: 3 }])).toBe(6)
  })
})

describe('daysToFlags / flagsToDays', () => {
  it('daysToFlags maps day names to a Monday-first boolean array', () => {
    expect(daysToFlags(['monday', 'friday'])).toEqual([true, false, false, false, true, false, false])
  })
  it('flagsToDays is the inverse', () => {
    expect(flagsToDays([true, false, false, false, true, false, false])).toEqual(['monday', 'friday'])
  })
  it('round-trips', () => {
    const days = ['tuesday', 'saturday', 'sunday']
    expect(flagsToDays(daysToFlags(days))).toEqual(days)
  })
  it('handles missing input', () => {
    expect(daysToFlags(undefined)).toEqual([false, false, false, false, false, false, false])
    expect(flagsToDays(undefined)).toEqual([])
  })
})

describe('hasAnyDay', () => {
  it('is true when at least one flag is set', () => {
    expect(hasAnyDay([false, false, true, false, false, false, false])).toBe(true)
  })
  it('is false when none are set', () => {
    expect(hasAnyDay([false, false, false, false, false, false, false])).toBe(false)
    expect(hasAnyDay(undefined)).toBe(false)
  })
})

describe('formatDayChips', () => {
  it('returns all seven days in order with on/off membership', () => {
    const chips = formatDayChips(['monday', 'wednesday'])
    expect(chips).toHaveLength(7)
    expect(chips[0]).toEqual({ day: 'monday', on: true })
    expect(chips[1]).toEqual({ day: 'tuesday', on: false })
    expect(chips[2]).toEqual({ day: 'wednesday', on: true })
  })
})
