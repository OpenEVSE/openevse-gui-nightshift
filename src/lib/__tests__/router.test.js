import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { get } from 'svelte/store'
import { currentPath, navigate, redirect } from '../router.js'

describe('hash router', () => {
  beforeEach(() => { window.history.replaceState(null, '', '#') })

  it('defaults to "/" when the hash is empty', () => {
    expect(get(currentPath)).toBe('/')
  })

  it('navigate updates the path and the location hash', () => {
    navigate('/schedule')
    expect(get(currentPath)).toBe('/schedule')
    expect(window.location.hash).toBe('#/schedule')
  })

  it('navigate pushes a history entry (Back returns to the prior route)', () => {
    navigate('/schedule')
    const depth = window.history.length
    navigate('/history')
    expect(window.history.length).toBe(depth + 1)
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

describe('hash router — anchor click interception', () => {
  let anchor
  beforeEach(() => {
    window.history.replaceState(null, '', '#')
    anchor = document.createElement('a')
    anchor.setAttribute('href', '#/monitoring')
    anchor.textContent = 'Monitoring'
    document.body.appendChild(anchor)
  })
  afterEach(() => { anchor.remove() })

  it('routes a plain hash-link click without a real fragment navigation', () => {
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    anchor.dispatchEvent(evt)
    expect(evt.defaultPrevented).toBe(true)
    expect(window.location.hash).toBe('#/monitoring')
    expect(get(currentPath)).toBe('/monitoring')
  })

  it('ignores modifier-clicks so open-in-new-tab keeps working', () => {
    const evt = new MouseEvent('click', {
      bubbles: true, cancelable: true, button: 0, metaKey: true,
    })
    anchor.dispatchEvent(evt)
    expect(evt.defaultPrevented).toBe(false)
  })

  it('ignores non-primary (middle/right) button clicks', () => {
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true, button: 1 })
    anchor.dispatchEvent(evt)
    expect(evt.defaultPrevented).toBe(false)
  })
})

describe('hash router — Back/Forward via popstate', () => {
  it('currentPath reacts to a popstate event', () => {
    let seen
    const unsub = currentPath.subscribe((v) => { seen = v })
    window.history.replaceState(null, '', '#/history')
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(seen).toBe('/history')
    unsub()
  })
})
