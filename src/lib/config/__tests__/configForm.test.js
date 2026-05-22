// src/lib/config/__tests__/configForm.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { httpAPI } from '../../api/httpAPI.js'
import { config_store } from '../../stores/config.js'
import { uistates_store } from '../../stores/uistates.js'
import { createConfigForm } from '../configForm.svelte.js'

describe('createConfigForm', () => {
  beforeEach(() => {
    config_store.set({ hostname: 'old' })
    uistates_store.resetAlertBox()
    httpAPI.mockReset()
  })

  it('saveField posts the field and updates the store on success', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const form = createConfigForm()
    const ok = await form.saveField('hostname', 'new')
    expect(ok).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('POST', '/config', JSON.stringify({ hostname: 'new' }))
    expect(get(config_store).hostname).toBe('new')
    expect(form.saveState.statusOf('hostname')).toBe('saved')
  })

  it('saveField marks error, does not change the store, and alerts on failure', async () => {
    httpAPI.mockResolvedValue('error')
    const form = createConfigForm()
    const ok = await form.saveField('hostname', 'new')
    expect(ok).toBe(false)
    expect(get(config_store).hostname).toBe('old')
    expect(form.saveState.statusOf('hostname')).toBe('error')
    expect(get(uistates_store).alertbox.visible).toBe(true)
  })

  it('revert counter increments only on failure', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const form = createConfigForm()
    const before = form.revert
    await form.saveField('hostname', 'a')
    expect(form.revert).toBe(before)
    httpAPI.mockResolvedValue('error')
    await form.saveField('hostname', 'b')
    expect(form.revert).toBe(before + 1)
  })

  it('saveFields posts several fields at once', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const form = createConfigForm()
    await form.saveFields({ www_username: '', www_password: '' })
    expect(httpAPI).toHaveBeenCalledWith(
      'POST', '/config', JSON.stringify({ www_username: '', www_password: '' }),
    )
    expect(get(config_store).www_username).toBe('')
  })
})
