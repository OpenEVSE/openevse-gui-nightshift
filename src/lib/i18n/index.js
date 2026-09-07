import { register, init, getLocaleFromNavigator } from 'svelte-i18n'
import { LOCALE_NAMES } from './locales.js'

register('en', () => import('./en.json'))
register('es', () => import('./es.json'))
register('fr', () => import('./fr.json'))
register('hu', () => import('./hu.json'))

// The browser's language narrowed to its base tag, if we ship it — else English.
// The device's configured language (config.lang) overrides this once loaded.
function initialLocale() {
  const nav = getLocaleFromNavigator()
  const base = nav ? nav.toLowerCase().split('-')[0] : 'en'
  return LOCALE_NAMES[base] ? base : 'en'
}

export function setupI18n() {
  init({
    fallbackLocale: 'en',
    initialLocale: initialLocale(),
  })
}
