// src/lib/components/__tests__/Router.blocked.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/svelte'
import Router from '../Router.svelte'
import Dummy from './fixtures/Dummy.svelte'

beforeEach(() => { window.location.hash = '' })

describe('Router blocked routes', () => {
  it('redirects a blocked path to / instead of rendering it', async () => {
    window.location.hash = '/settings/ocpp'
    window.dispatchEvent(new Event('hashchange'))
    render(Router, { props: { routes: { '/settings/ocpp': Dummy }, blocked: ['/settings/ocpp'] } })
    await vi.waitFor(() => expect(window.location.hash).toBe('#/'))
  })
  it('renders a non-blocked path normally', () => {
    window.location.hash = '/settings/ocpp'
    window.dispatchEvent(new Event('hashchange'))
    const { getByText } = render(Router, { props: { routes: { '/settings/ocpp': Dummy }, blocked: [] } })
    expect(getByText('dummy')).toBeInTheDocument()
  })
})
