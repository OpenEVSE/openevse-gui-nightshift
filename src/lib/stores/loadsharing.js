import { writable } from 'svelte/store'
import { httpAPI } from '../api/httpAPI.js'

function createLoadSharingStore() {
  const P = writable({ peers: [], status: null })
  const { subscribe, set, update } = P

  async function downloadPeers() {
    const res = await httpAPI('GET', '/loadsharing/peers')
    if (res && res !== 'error' && res.msg !== 'error') {
      update((s) => ({ ...s, peers: Array.isArray(res) ? res : [] }))
      return true
    }
    return false
  }

  async function downloadStatus() {
    const res = await httpAPI('GET', '/loadsharing/status')
    if (res && res !== 'error' && res.msg !== 'error') {
      update((s) => ({ ...s, status: res }))
      return true
    }
    return false
  }

  async function addPeer(host) {
    const res = await httpAPI('POST', '/loadsharing/peers', JSON.stringify({ host }))
    return res?.msg === 'done'
  }

  async function removePeer(host) {
    const res = await httpAPI('DELETE', `/loadsharing/peers/${encodeURIComponent(host)}`)
    return res?.msg === 'done'
  }

  async function discover() {
    const res = await httpAPI('POST', '/loadsharing/discover')
    return res?.msg === 'done'
  }

  async function refresh() {
    const [peersOk, statusOk] = await Promise.all([downloadPeers(), downloadStatus()])
    return peersOk || statusOk
  }

  return {
    subscribe,
    set,
    update,
    downloadPeers,
    downloadStatus,
    addPeer,
    removePeer,
    discover,
    refresh,
  }
}

export const loadsharing_store = createLoadSharingStore()
