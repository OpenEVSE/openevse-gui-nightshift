import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import Router from '../Router.svelte'
import NotFound from '../../../routes/NotFound.svelte'
// Any presentational component works as a route stub.
import ProgressBar from '../ui/ProgressBar.svelte'

describe('Router', () => {
  beforeEach(() => { window.location.hash = '' })

  it('renders the fallback for an unknown path', async () => {
    window.location.hash = '#/no-such-page'
    const { getByText } = render(Router, {
      props: { routes: {}, fallback: NotFound },
    })
    await vi.waitFor(() => {
      expect(getByText('screen.notfound')).toBeInTheDocument()
    })
  })

  it('redirects a legacy alias to its new route without flashing the fallback', async () => {
    window.location.hash = '#/configuration/evse'
    const { getByRole, queryByText } = render(Router, {
      props: {
        routes: { '/settings/evse': ProgressBar },
        fallback: NotFound,
        aliases: { '/configuration/evse': '/settings/evse' },
      },
    })
    expect(queryByText('screen.notfound')).toBeNull()
    await vi.waitFor(() => {
      expect(window.location.hash).toBe('#/settings/evse')
      expect(getByRole('progressbar')).toBeInTheDocument()
    })
    expect(queryByText('screen.notfound')).toBeNull()
  })
})
