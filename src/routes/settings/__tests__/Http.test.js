// src/routes/settings/__tests__/Http.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { get } from 'svelte/store'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t, locales: { subscribe: (fn) => { fn(['en']); return () => {} } } }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'done' })) }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import Http from '../Http.svelte'

beforeEach(() => {
  uistates_store.resetAlertBox()
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'done' })
})

describe('HTTP page', () => {
  it('shows the credential fields when auth is already configured', () => {
    config_store.set({ www_username: 'admin', www_password: '••••••••••', lang: 'en' })
    const { getByText } = render(Http)
    expect(getByText('config.http.username')).toBeInTheDocument()
  })

  it('hides the credential fields when auth is off', () => {
    config_store.set({ www_username: '', www_password: '', lang: 'en' })
    const { queryByText } = render(Http)
    expect(queryByText('config.http.username')).not.toBeInTheDocument()
  })

  it('turning the auth toggle off clears both credentials', async () => {
    config_store.set({ www_username: 'admin', www_password: '••••••••••', lang: 'en' })
    const { getByRole } = render(Http)
    await fireEvent.click(getByRole('switch'))
    expect(httpAPI).toHaveBeenCalledWith(
      'POST', '/config', JSON.stringify({ www_username: '', www_password: '' }),
    )
  })

  it('surfaces the write-error alert on a failed save', async () => {
    httpAPI.mockResolvedValue('error')
    config_store.set({ www_username: 'admin', www_password: '••••••••••', lang: 'en' })
    const { getByRole } = render(Http)
    await fireEvent.click(getByRole('switch'))
    await vi.waitFor(() => {
      expect(get(uistates_store).alertbox.visible).toBe(true)
    })
  })
})
