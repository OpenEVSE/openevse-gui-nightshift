import { describe, it, expect } from 'vitest'
import {
  CABLE_TEMP_PIN_PP, CABLE_TEMP_PIN_PP2,
  cableTempStatusKey, cableTempSourceOnPin, cableTempSourceByIndex,
  cableTempSourceOptions, c10ToC, cToC10, cableTempHasAssignedSource,
} from '../cabletemp.js'

const cabletemp = {
  sources: [
    { source: 0, name: 'ev1', pin: 1, status: 0, temperature: 34.5, r25: 10000, beta: 3443, offset_c10: 0, panic_c10: 900 },
    { source: 1, name: 'ev2', pin: 0, status: 1 },
    { source: 2, name: 'in1', pin: 2, status: 2 },
    { source: 3, name: 'in2', pin: 0, status: 1 },
  ],
}

describe('cableTempStatusKey', () => {
  it('maps non-OK statuses to their i18n suffix', () => {
    expect(cableTempStatusKey(1)).toBe('not_installed')
    expect(cableTempStatusKey(2)).toBe('open')
    expect(cableTempStatusKey(3)).toBe('shorted')
  })
  it('returns null for OK (0) and unknown statuses', () => {
    expect(cableTempStatusKey(0)).toBe(null)
    expect(cableTempStatusKey(99)).toBe(null)
    expect(cableTempStatusKey(undefined)).toBe(null)
  })
})

describe('cableTempSourceOnPin / cableTempSourceByIndex', () => {
  it('finds the source wired to a pin', () => {
    expect(cableTempSourceOnPin(cabletemp, CABLE_TEMP_PIN_PP).name).toBe('ev1')
    expect(cableTempSourceOnPin(cabletemp, CABLE_TEMP_PIN_PP2).name).toBe('in1')
  })
  it('returns null when no source is on that pin, or input is missing', () => {
    expect(cableTempSourceOnPin(cabletemp, 3)).toBe(null)
    expect(cableTempSourceOnPin(undefined, CABLE_TEMP_PIN_PP)).toBe(null)
  })
  it('finds a source by its logical index', () => {
    expect(cableTempSourceByIndex(cabletemp, 2).name).toBe('in1')
    expect(cableTempSourceByIndex(cabletemp, 9)).toBe(null)
  })
})

describe('cableTempSourceOptions', () => {
  it('lists None plus all 4 sources, disabling whichever is already on the other pin', () => {
    const opts = cableTempSourceOptions(cabletemp, CABLE_TEMP_PIN_PP, CABLE_TEMP_PIN_PP2, 'None', (n) => n.toUpperCase())
    expect(opts).toHaveLength(5)
    expect(opts[0]).toEqual({ value: '', label: 'None' })
    // in1 (index 2) is on the other pin (PP2) -> disabled here
    expect(opts.find((o) => o.value === '2')).toEqual({ value: '2', label: 'IN1', disabled: true })
    expect(opts.find((o) => o.value === '0')).toEqual({ value: '0', label: 'EV1', disabled: false })
  })
})

describe('c10ToC / cToC10', () => {
  it('round-trips tenths-of-a-degree <-> degrees', () => {
    expect(c10ToC(900)).toBe(90)
    expect(c10ToC(-15)).toBe(-1.5)
    expect(cToC10(90)).toBe(900)
    expect(cToC10(-1.5)).toBe(-15)
  })
  it('is null-safe', () => {
    expect(c10ToC(null)).toBe(null)
    expect(c10ToC(undefined)).toBe(null)
    expect(cToC10(null)).toBe(null)
  })
})

describe('cableTempHasAssignedSource', () => {
  it('is true when any source has a non-zero pin', () => {
    expect(cableTempHasAssignedSource(cabletemp)).toBe(true)
  })
  it('is false when every source is unassigned, or input is missing', () => {
    expect(cableTempHasAssignedSource({ sources: cabletemp.sources.map((s) => ({ ...s, pin: 0 })) })).toBe(false)
    expect(cableTempHasAssignedSource(undefined)).toBe(false)
  })
})
