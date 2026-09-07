import { register, init, getLocaleFromNavigator } from 'svelte-i18n'
import { LOCALE_NAMES } from './locales.js'
import { hydrateLocale } from './hydrate.js'

register('en', () => import('./en.json'))

// es/fr/hu ship as position-encoded value arrays (see
// scripts/build-locale-values.mjs) rather than repeating en's ~1,000 key
// names in every catalog. Reassemble the real dictionary from en's shape --
// which every locale already loads anyway as the svelte-i18n fallback --
// plus this locale's values.
async function loadPositional(valuesImport) {
  const [{ default: en }, { default: values }] = await Promise.all([import('./en.json'), valuesImport])
  return hydrateLocale(en, values)
}

register('es', () => loadPositional(import('./es.json')))
register('fr', () => loadPositional(import('./fr.json')))
register('hu', () => loadPositional(import('./hu.json')))

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
