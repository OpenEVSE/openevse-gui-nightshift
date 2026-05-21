import { describe, it, expect, beforeEach } from 'vitest'
import { get } from 'svelte/store'
import { currentPath, navigate } from '../router.js'

describe('hash router', () => {
  beforeEach(() => { window.location.hash = '' })

  it('defaults to "/" when the hash is empty', () => {
    expect(get(currentPath)).toBe('/')
  })

  it('navigate updates the path and the location hash', () => {
    navigate('/schedule')
    expect(get(currentPath)).toBe('/schedule')
    expect(window.location.hash).toBe('#/schedule')
  })
})
