import { get } from 'svelte/store'
import { uistates_store } from '../stores/uistates.js'
import { redirect } from '../router.js'

// `raw: true` resolves to { status, body } instead of just the parsed body,
// for callers that need to tell an HTTP error apart from a successful
// response by status code rather than by matching the response text (which
// breaks silently if the server's wording ever changes). The 401/network
// error paths still resolve to the plain 'error' string either way, so a
// caller that opts in only needs to check `res === 'error'` before reading
// `res.status`.
export async function httpAPI(method, url, body = null, type = 'json', timeout = 60000, { raw = false } = {}) {
  const content_type =
    type === 'json'
      ? 'application/json'
      : 'application/x-www-form-urlencoded; charset=UTF-8'
  const controller = new AbortController()
  const data = {
    method,
    signal: controller.signal,
    // X-Requested-With is required by the firmware CSRF guard on cookie-authed
    // mutations; a cross-origin form cannot set it. Harmless on GETs.
    headers: { 'Content-Type': content_type, 'X-Requested-With': 'OpenEVSE' },
  }
  if (body) data.body = body
  // do not timeout on the first request, in case authentication is needed
  if (get(uistates_store).has_fetched) {
    setTimeout(() => controller.abort(), timeout)
  }
  if (import.meta.env.DEV) {
    if (!url.includes('http', 0)) url = '/api' + url
  }
  const res = await fetch(url, data)
    .then(async (response) => {
      // Session expired / not logged in: send the user to the login page.
      // Login.svelte posts to /login with a bare fetch (not httpAPI), so this
      // interceptor never fires during the login request itself.
      if (response.status === 401) {
        redirect('/login')
        return 'error'
      }
      const parsed = type === 'json' ? await response.json() : await response.text()
      return raw ? { status: response.status, body: parsed } : parsed
    })
    .catch((error) => {
      console.log(error)
      return 'error'
    })
  uistates_store.update((x) => {
    x.has_fetched = true
    return x
  })
  return res
}
