import { describe, it, expect, beforeEach } from 'vitest'
import { get } from 'svelte/store'
import { currentPath, navigate, redirect } from '../router.js'

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

  it('redirect updates the path in place (no history entry)', () => {
    navigate('/configuration/evse')
    const depth = window.history.length
    redirect('/settings/evse')
    expect(get(currentPath)).toBe('/settings/evse')
    expect(window.location.hash).toBe('#/settings/evse')
    expect(window.history.length).toBe(depth)
  })
})
