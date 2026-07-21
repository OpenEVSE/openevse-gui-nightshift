import { get } from 'svelte/store'
import { uistates_store } from '../stores/uistates.js'
import { redirect } from '../router.js'

export async function httpAPI(method, url, body = null, type = 'json', timeout = 60000) {
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
    .then((response) => {
      // Session expired / not logged in: send the user to the login page.
      // Login.svelte posts to /login with a bare fetch (not httpAPI), so this
      // interceptor never fires during the login request itself.
      if (response.status === 401) {
        redirect('/login')
        return 'error'
      }
      return type === 'json' ? response.json() : response.text()
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
