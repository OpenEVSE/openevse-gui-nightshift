// src/lib/config/__tests__/saveState.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { get } from 'svelte/store'
import { createSaveState, SAVED_LINGER_MS } from '../saveState.js'

describe('createSaveState', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts empty — every field is idle', () => {
    const s = createSaveState()
    expect(get(s)).toEqual({})
  })

  it('begin() marks a field saving', () => {
    const s = createSaveState()
    s.begin('hostname')
    expect(get(s).hostname).toBe('saving')
  })

  it('fail() marks a field error', () => {
    const s = createSaveState()
    s.begin('hostname')
    s.fail('hostname')
    expect(get(s).hostname).toBe('error')
  })

  it('succeed() shows saved then auto-clears to idle after the linger', () => {
    const s = createSaveState()
    s.begin('hostname')
    s.succeed('hostname')
    expect(get(s).hostname).toBe('saved')
    vi.advanceTimersByTime(SAVED_LINGER_MS)
    expect(get(s).hostname).toBe('idle')
  })

  it('a new begin() cancels a pending saved auto-clear', () => {
    const s = createSaveState()
    s.succeed('hostname')
    s.begin('hostname')
    vi.advanceTimersByTime(SAVED_LINGER_MS)
    expect(get(s).hostname).toBe('saving')
  })

  it('tracks fields independently', () => {
    const s = createSaveState()
    s.begin('a')
    s.fail('b')
    expect(get(s)).toEqual({ a: 'saving', b: 'error' })
  })

  it('statusOf() returns the field status, idle when absent', () => {
    const s = createSaveState()
    expect(s.statusOf('hostname')).toBe('idle')
    s.begin('hostname')
    expect(s.statusOf('hostname')).toBe('saving')
    s.fail('hostname')
    expect(s.statusOf('hostname')).toBe('error')
  })
})
