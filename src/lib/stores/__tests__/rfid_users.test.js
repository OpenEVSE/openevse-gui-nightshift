import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'

vi.mock('../../api/httpAPI.js', () => ({ httpAPI: vi.fn() }))
vi.mock('../../queue.js', () => ({
  serialQueue: { add: vi.fn((fn) => fn()) },
}))

import { rfid_users_store } from '../rfid_users.js'
import { httpAPI } from '../../api/httpAPI.js'

describe('rfid_users_store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rfid_users_store.reset()
  })

  it('starts empty', () => {
    const s = get(rfid_users_store)
    expect(s.users).toEqual({})
    expect(s.loading).toBe(false)
    expect(s.error).toBe(false)
  })

  it('download() fetches /rfid/users and stores the map', async () => {
    httpAPI.mockResolvedValue({ AA11: 'Alice', BB22: 'Bob' })
    const ok = await rfid_users_store.download()
    expect(ok).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith('GET', '/rfid/users')
    expect(get(rfid_users_store).users).toEqual({ AA11: 'Alice', BB22: 'Bob' })
  })

  it('download() sets error on a string error response (firmware lacks endpoint)', async () => {
    httpAPI.mockResolvedValue('error')
    const ok = await rfid_users_store.download()
    expect(ok).toBe(false)
    expect(get(rfid_users_store).error).toBe(true)
  })

  it('download() sets error on an array response (shape guard)', async () => {
    httpAPI.mockResolvedValue([])
    const ok = await rfid_users_store.download()
    expect(ok).toBe(false)
    expect(get(rfid_users_store).error).toBe(true)
  })

  it('save() POSTs the rfid+name body and merges into the map', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    const ok = await rfid_users_store.save('AA11', 'Alice')
    expect(ok).toBe(true)
    expect(httpAPI).toHaveBeenCalledWith(
      'POST', '/rfid/users', JSON.stringify({ rfid: 'AA11', name: 'Alice' }),
    )
    expect(get(rfid_users_store).users).toEqual({ AA11: 'Alice' })
  })

  it('save() returns false and leaves state alone on a failed POST', async () => {
    httpAPI.mockResolvedValue('error')
    const ok = await rfid_users_store.save('AA11', 'Alice')
    expect(ok).toBe(false)
    expect(get(rfid_users_store).users).toEqual({})
  })

  it('remove() DELETEs with the uid query and drops the entry', async () => {
    httpAPI.mockResolvedValueOnce({ msg: 'done' })
    await rfid_users_store.save('AA11', 'Alice')
    httpAPI.mockResolvedValueOnce({ msg: 'done' })
    const ok = await rfid_users_store.remove('AA11')
    expect(ok).toBe(true)
    expect(httpAPI).toHaveBeenLastCalledWith('DELETE', '/rfid/users?rfid=AA11')
    expect(get(rfid_users_store).users).toEqual({})
  })

  it('remove() URI-encodes the uid', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    await rfid_users_store.remove('a/b c')
    expect(httpAPI).toHaveBeenCalledWith('DELETE', '/rfid/users?rfid=a%2Fb%20c')
  })
})
