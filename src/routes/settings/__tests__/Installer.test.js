// src/routes/settings/__tests__/Installer.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? `${k}:${JSON.stringify(opts.values)}` : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { uistates_store } from '../../../lib/stores/uistates.js'
import { notification_store } from '../../../lib/stores/notifications.js'
import Installer from '../Installer.svelte'

const CONFIG = {
  max_current_hard: 32,
  gfci_check: true, ground_check: true, relay_check: true,
  temp_check: true, diode_check: true, vent_check: true,
}

// Reply table for the /installer endpoints; each test overrides what it needs.
let replies
function wire() {
  httpAPI.mockImplementation((method, url, body) => {
    if (method === 'GET' && url === '/config') return Promise.resolve({ ...CONFIG, ...replies.config })
    const r = replies[url]
    return Promise.resolve(typeof r === 'function' ? r(body) : r ?? { status: 200, body: { msg: 'ok' } })
  })
}

const posts = (url) => httpAPI.mock.calls.filter((c) => c[0] === 'POST' && c[1] === url)

async function unlock(utils, password = 'installer') {
  const input = utils.container.querySelector('input[type="password"]')
  await fireEvent.input(input, { target: { value: password } })
  await fireEvent.blur(input)
  await fireEvent.click(utils.getByText('config.installer.unlock'))
  await vi.waitFor(() => expect(utils.queryByText('config.installer.unlock')).toBeNull())
}

beforeEach(() => {
  uistates_store.resetAlertBox()
  notification_store.reset()
  replies = {}
  httpAPI.mockReset()
  wire()
  config_store.set({ ...CONFIG })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Installer Tools — password gate', () => {
  it('shows only the password prompt until unlocked', () => {
    const { getByText, queryByText } = render(Installer)
    expect(getByText('config.installer.lock_title')).toBeInTheDocument()
    expect(queryByText('config.installer.maxcurrent_title')).toBeNull()
    expect(queryByText('config.safety.checks')).toBeNull()
    expect(queryByText('config.installer.password_title')).toBeNull()
  })

  it('verifies the password with the charger, not locally', async () => {
    const utils = render(Installer)
    await unlock(utils, 'installer')
    expect(posts('/installer/verify')).toHaveLength(1)
    expect(posts('/installer/verify')[0][2]).toBe(JSON.stringify({ password: 'installer' }))
  })

  it('reveals the tools once the charger accepts the password', async () => {
    const utils = render(Installer)
    await unlock(utils)
    expect(utils.getByText('config.installer.maxcurrent_title')).toBeInTheDocument()
    expect(utils.getByText('config.safety.checks')).toBeInTheDocument()
    expect(utils.getByText('config.installer.password_title')).toBeInTheDocument()
  })

  it('stays locked and says so on a wrong password', async () => {
    replies['/installer/verify'] = { status: 403, body: { msg: 'wrong password' } }
    const utils = render(Installer)
    const input = utils.container.querySelector('input[type="password"]')
    await fireEvent.input(input, { target: { value: 'nope' } })
    await fireEvent.blur(input)
    await fireEvent.click(utils.getByText('config.installer.unlock'))
    await vi.waitFor(() => expect(utils.getByRole('alert')).toHaveTextContent('config.installer.wrong'))
    expect(utils.queryByText('config.installer.maxcurrent_title')).toBeNull()
  })

  it('reports the lockout wait the charger asks for', async () => {
    replies['/installer/verify'] = { status: 429, body: { msg: 'locked', retry_after: 17 } }
    const utils = render(Installer)
    await fireEvent.click(utils.getByText('config.installer.unlock'))
    await vi.waitFor(() =>
      expect(utils.getByRole('alert')).toHaveTextContent('config.installer.locked:{"sec":17}'))
  })

  it('sends the typed password when Enter submits the form', async () => {
    // Enter in a form: the browser clicks the submit button while the field
    // still has focus -- it has not blurred, so it has not committed its value.
    const utils = render(Installer)
    const input = utils.container.querySelector('input[type="password"]')
    input.focus()
    await fireEvent.focus(input)
    await fireEvent.input(input, { target: { value: 'installer' } })
    utils.container.querySelector('button[type="submit"]').click()
    await vi.waitFor(() => expect(utils.queryByText('config.installer.unlock')).toBeNull())
    expect(posts('/installer/verify').map((c) => c[2])).toEqual([JSON.stringify({ password: 'installer' })])
  })

  it('does not unlock when the charger cannot be reached', async () => {
    replies['/installer/verify'] = 'error'
    const utils = render(Installer)
    await fireEvent.click(utils.getByText('config.installer.unlock'))
    await vi.waitFor(() => expect(utils.getByRole('alert')).toHaveTextContent('config.installer.unreachable'))
    expect(utils.queryByText('config.installer.maxcurrent_title')).toBeNull()
  })

  it('locks again on demand', async () => {
    const utils = render(Installer)
    await unlock(utils)
    await fireEvent.click(utils.getByText('config.installer.lock'))
    expect(utils.getByText('config.installer.lock_title')).toBeInTheDocument()
    expect(utils.queryByText('config.installer.maxcurrent_title')).toBeNull()
  })
})

describe('Installer Tools — hardware maximum current', () => {
  it('shows the current hardware maximum and the one-time caution', async () => {
    const utils = render(Installer)
    await unlock(utils)
    expect(utils.getByText('32 A')).toBeInTheDocument()
    expect(utils.getByText('config.installer.maxcurrent_note_title')).toBeInTheDocument()
    expect(utils.getByText('config.installer.maxcurrent_note')).toBeInTheDocument()
    expect(utils.getByText('config.installer.maxcurrent_note_nec')).toBeInTheDocument()
  })

  it('asks for confirmation and sends nothing until it is given', async () => {
    const utils = render(Installer)
    await unlock(utils)
    await fireEvent.click(utils.getByText('config.installer.maxcurrent_set'))
    expect(utils.getByText('config.installer.confirm_title')).toBeInTheDocument()
    expect(posts('/installer/maxcurrent')).toHaveLength(0)

    await fireEvent.click(utils.getByText('config.installer.confirm_no'))
    expect(posts('/installer/maxcurrent')).toHaveLength(0)
  })

  it('sends the amps with the verified password once confirmed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    replies.config = { max_current_hard: 24 }
    const utils = render(Installer)
    await unlock(utils)
    const amps = utils.getByRole('spinbutton')
    await fireEvent.input(amps, { target: { value: '24' } })
    await fireEvent.blur(amps)
    await fireEvent.click(utils.getByText('config.installer.maxcurrent_set'))
    await fireEvent.click(utils.getByText('config.installer.confirm_yes'))
    await vi.waitFor(() => expect(posts('/installer/maxcurrent')).toHaveLength(1))
    expect(posts('/installer/maxcurrent')[0][2]).toBe(JSON.stringify({ password: 'installer', amps: 24 }))
  })

  it('reports success when the charger reads back the requested value', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    replies.config = { max_current_hard: 24 }
    const utils = render(Installer)
    await unlock(utils)
    const amps = utils.getByRole('spinbutton')
    await fireEvent.input(amps, { target: { value: '24' } })
    await fireEvent.blur(amps)
    await fireEvent.click(utils.getByText('config.installer.maxcurrent_set'))
    await fireEvent.click(utils.getByText('config.installer.confirm_yes'))
    await vi.advanceTimersByTimeAsync(2500)
    await vi.waitFor(() =>
      expect(utils.getByRole('status')).toHaveTextContent('config.installer.maxcurrent_applied:{"amps":24}'))
  })

  it('says so when the controller keeps the old value (already set once)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const utils = render(Installer) // the charger keeps reporting 32
    await unlock(utils)
    const amps = utils.getByRole('spinbutton')
    await fireEvent.input(amps, { target: { value: '24' } })
    await fireEvent.blur(amps)
    await fireEvent.click(utils.getByText('config.installer.maxcurrent_set'))
    await fireEvent.click(utils.getByText('config.installer.confirm_yes'))
    await vi.advanceTimersByTimeAsync(2500)
    await vi.waitFor(() =>
      expect(utils.getByRole('status')).toHaveTextContent('config.installer.maxcurrent_unchanged'))
  })

  it('does not offer an out-of-range value', async () => {
    const utils = render(Installer)
    await unlock(utils)
    const amps = utils.getByRole('spinbutton')
    await fireEvent.input(amps, { target: { value: '95' } })
    await fireEvent.blur(amps)
    expect(utils.getByText('config.installer.maxcurrent_set').closest('button')).toBeDisabled()
  })

  it('does not offer a value above the current hardware maximum', async () => {
    // The limit only comes down; the charger refuses anything higher.
    const utils = render(Installer) // the charger reports 32
    await unlock(utils)
    const amps = utils.getByRole('spinbutton')
    await fireEvent.input(amps, { target: { value: '40' } })
    await fireEvent.blur(amps)
    expect(utils.getByText('config.installer.maxcurrent_set').closest('button')).toBeDisabled()
  })

  it('explains an amps refusal rather than calling the charger unreachable', async () => {
    replies['/installer/maxcurrent'] = { status: 400, body: { msg: 'amps out of range' } }
    const utils = render(Installer)
    await unlock(utils)
    await fireEvent.click(utils.getByText('config.installer.maxcurrent_set'))
    await fireEvent.click(utils.getByText('config.installer.confirm_yes'))
    await vi.waitFor(() =>
      expect(utils.getByRole('status')).toHaveTextContent('config.installer.maxcurrent_out_of_range:{"min":6,"max":32}'))
  })

  it('surfaces a refusal from the charger', async () => {
    replies['/installer/maxcurrent'] = { status: 403, body: { msg: 'wrong password' } }
    const utils = render(Installer)
    await unlock(utils)
    await fireEvent.click(utils.getByText('config.installer.maxcurrent_set'))
    await fireEvent.click(utils.getByText('config.installer.confirm_yes'))
    await vi.waitFor(() =>
      expect(utils.getByRole('status')).toHaveTextContent('config.installer.wrong'))
  })
})

describe('Installer Tools — safety checks', () => {
  it('hosts the Safety checks card with the GFCI note', async () => {
    const utils = render(Installer)
    await unlock(utils)
    await fireEvent.click(utils.getByText('config.safety.checks'))
    expect(utils.getByLabelText('config.safety.gfci_check')).toBeInTheDocument()
    expect(utils.getByText('config.safety.gfci_check_desc')).toBeInTheDocument()
  })
})

describe('Installer Tools — change installer password', () => {
  async function fill(utils, current, next, confirm) {
    const inputs = utils.container.querySelectorAll('input[type="password"]')
    for (const [el, v] of [[inputs[0], current], [inputs[1], next], [inputs[2], confirm]]) {
      await fireEvent.input(el, { target: { value: v } })
      await fireEvent.blur(el)
    }
  }

  it('sends the current and new password to the charger', async () => {
    const utils = render(Installer)
    await unlock(utils)
    await fill(utils, 'installer', 'hunter22', 'hunter22')
    await fireEvent.click(utils.getByText('config.installer.password_change'))
    await vi.waitFor(() => expect(posts('/installer/password')).toHaveLength(1))
    expect(posts('/installer/password')[0][2]).toBe(JSON.stringify({ current: 'installer', new: 'hunter22' }))
    await vi.waitFor(() => expect(utils.getByRole('status')).toHaveTextContent('config.installer.password_done'))
  })

  it('refuses a mismatched confirmation without calling the charger', async () => {
    const utils = render(Installer)
    await unlock(utils)
    await fill(utils, 'installer', 'hunter22', 'hunter23')
    await fireEvent.click(utils.getByText('config.installer.password_change'))
    expect(utils.getByRole('status')).toHaveTextContent('config.installer.password_mismatch')
    expect(posts('/installer/password')).toHaveLength(0)
  })

  it('refuses a too-short password without calling the charger', async () => {
    const utils = render(Installer)
    await unlock(utils)
    await fill(utils, 'installer', 'abc', 'abc')
    await fireEvent.click(utils.getByText('config.installer.password_change'))
    expect(utils.getByRole('status')).toHaveTextContent('config.installer.password_invalid')
    expect(posts('/installer/password')).toHaveLength(0)
  })

  it('reports a wrong current password', async () => {
    replies['/installer/password'] = { status: 403, body: { msg: 'wrong password' } }
    const utils = render(Installer)
    await unlock(utils)
    await fill(utils, 'bad', 'hunter22', 'hunter22')
    await fireEvent.click(utils.getByText('config.installer.password_change'))
    await vi.waitFor(() => expect(utils.getByRole('status')).toHaveTextContent('config.installer.wrong'))
  })

  it('uses the new password for later actions in the same session', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const utils = render(Installer)
    await unlock(utils)
    await fill(utils, 'installer', 'hunter22', 'hunter22')
    await fireEvent.click(utils.getByText('config.installer.password_change'))
    await vi.waitFor(() => expect(utils.getByRole('status')).toHaveTextContent('config.installer.password_done'))

    await fireEvent.click(utils.getByText('config.installer.maxcurrent_set'))
    await fireEvent.click(utils.getByText('config.installer.confirm_yes'))
    await vi.waitFor(() => expect(posts('/installer/maxcurrent')).toHaveLength(1))
    expect(JSON.parse(posts('/installer/maxcurrent')[0][2]).password).toBe('hunter22')
  })
})
