import { writable } from 'svelte/store'
import { httpAPI } from '../api/httpAPI.js'
import { serialQueue } from '../queue.js'

function emptyState() {
  return {
    raw: { samples: [], historical: false, noOlder: false },
    daily: [],
    monthly: [],
    annual: [],
    loading: { raw: false, daily: false, monthly: false, annual: false },
    error:   { raw: false, daily: false, monthly: false, annual: false },
  }
}

function createEnergyStore() {
  const P = writable(emptyState())
  const { subscribe, update, set } = P

  function setLoading(key, v) { update((s) => ({ ...s, loading: { ...s.loading, [key]: v } })) }
  function setError(key, v)   { update((s) => ({ ...s, error:   { ...s.error,   [key]: v } })) }

  async function loadRaw(before = 0) {
    const url = before > 0 ? `/energy/raw?before=${before}` : '/energy/raw'
    setLoading('raw', true); setError('raw', false)
    const res = await serialQueue.add(() => httpAPI('GET', url))
    setLoading('raw', false)
    if (!res || res === 'error' || res.msg === 'error' || !Array.isArray(res.samples)) {
      setError('raw', true)
      return false
    }
    update((s) => {
      const historical = before > 0
      if (historical && res.samples.length === 0) {
        return { ...s, raw: { ...s.raw, noOlder: true } }
      }
      return { ...s, raw: { samples: res.samples, historical, noOlder: false } }
    })
    return true
  }

  async function loadSummary(key, urlPath, fieldName) {
    setLoading(key, true); setError(key, false)
    const res = await serialQueue.add(() => httpAPI('GET', urlPath))
    setLoading(key, false)
    if (!res || res === 'error' || res.msg === 'error' || !Array.isArray(res[fieldName])) {
      setError(key, true)
      return false
    }
    update((s) => ({ ...s, [key]: res[fieldName] }))
    return true
  }

  return {
    subscribe,
    set,
    reset: () => set(emptyState()),
    loadRaw,
    loadDaily:   () => loadSummary('daily',   '/energy/daily',   'daily'),
    loadMonthly: () => loadSummary('monthly', '/energy/monthly', 'monthly'),
    loadAnnual:  () => loadSummary('annual',  '/energy/annual',  'annual'),
  }
}

export const energy_store = createEnergyStore()
