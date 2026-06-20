import { describe, it, expect } from 'vitest'
import { formatDuration, formatAgo, formatCountdown } from '../duration.js'

describe('formatDuration', () => {
  it('formats sub-minute durations', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(1)).toBe('1s')
    expect(formatDuration(59)).toBe('59s')
  })

  it('formats minute durations with seconds', () => {
    expect(formatDuration(60)).toBe('1m 0s')
    expect(formatDuration(90)).toBe('1m 30s')
    expect(formatDuration(3599)).toBe('59m 59s')
  })

  it('formats hour durations with minutes', () => {
    expect(formatDuration(3600)).toBe('1h 0m')
    expect(formatDuration(3661)).toBe('1h 1m')
    expect(formatDuration(7320)).toBe('2h 2m')
  })

  it('clamps negative input to zero', () => {
    expect(formatDuration(-5)).toBe('0s')
  })

  it('floors fractional seconds', () => {
    expect(formatDuration(90.9)).toBe('1m 30s')
  })
})

describe('formatAgo', () => {
  const now = 1_000_000 * 1000 // 1,000,000 s epoch, in ms

  it('returns null for falsy timestamps', () => {
    expect(formatAgo(0, now)).toBeNull()
    expect(formatAgo(null, now)).toBeNull()
    expect(formatAgo(undefined, now)).toBeNull()
  })

  it('formats recent timestamps', () => {
    expect(formatAgo(1_000_000, now)).toBe('0s ago')
    expect(formatAgo(999_995, now)).toBe('5s ago')
    expect(formatAgo(999_400, now)).toBe('10m 0s ago')
  })

  it('formats multi-hour gaps', () => {
    expect(formatAgo(1_000_000 - 7320, now)).toBe('2h 2m ago')
  })

  it('clamps future timestamps to 0s ago', () => {
    expect(formatAgo(1_000_050, now)).toBe('0s ago')
  })
})

describe('formatCountdown', () => {
  it('returns dash for null/undefined', () => {
    expect(formatCountdown(null)).toBe('—')
    expect(formatCountdown(undefined)).toBe('—')
  })

  it('returns dash when already elapsed', () => {
    expect(formatCountdown(0)).toBe('—')
    expect(formatCountdown(-1000)).toBe('—')
  })

  it('rounds up partial seconds', () => {
    expect(formatCountdown(1)).toBe('1s')
    expect(formatCountdown(1500)).toBe('2s')
    expect(formatCountdown(59_000)).toBe('59s')
  })

  it('formats minutes and hours', () => {
    expect(formatCountdown(90_000)).toBe('1m 30s')
    expect(formatCountdown(3_600_000)).toBe('1h 0m')
  })
})
