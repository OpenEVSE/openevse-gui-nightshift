// src/lib/config/__tests__/rfid.test.js
import { describe, it, expect } from 'vitest'
import { parseTags, serializeTags, addTag, removeTag } from '../rfid.js'

describe('parseTags', () => {
  it('splits a comma-separated string, trimming blanks', () => {
    expect(parseTags('AA,BB,CC')).toEqual(['AA', 'BB', 'CC'])
    expect(parseTags('AA, BB ,')).toEqual(['AA', 'BB'])
  })
  it('returns an empty array for empty / missing input', () => {
    expect(parseTags('')).toEqual([])
    expect(parseTags(undefined)).toEqual([])
    expect(parseTags(null)).toEqual([])
  })
})

describe('serializeTags', () => {
  it('joins an array with commas', () => {
    expect(serializeTags(['AA', 'BB'])).toBe('AA,BB')
    expect(serializeTags([])).toBe('')
  })
})

describe('addTag', () => {
  it('appends a new tag', () => {
    expect(addTag(['AA'], 'BB')).toEqual(['AA', 'BB'])
  })
  it('does not duplicate an existing tag', () => {
    expect(addTag(['AA', 'BB'], 'AA')).toEqual(['AA', 'BB'])
  })
})

describe('removeTag', () => {
  it('drops the named tag', () => {
    expect(removeTag(['AA', 'BB', 'CC'], 'BB')).toEqual(['AA', 'CC'])
  })
  it('is a no-op when the tag is absent', () => {
    expect(removeTag(['AA'], 'ZZ')).toEqual(['AA'])
  })
})
