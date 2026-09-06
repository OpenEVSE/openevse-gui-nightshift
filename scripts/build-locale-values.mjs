// Generates src/lib/i18n/{es,fr,hu}.json as flat, position-encoded value
// arrays from the human-maintained catalogs in src/lib/i18n/source/.
//
// en.json is the key source and ships as-is (nested, keyed) since it needs
// no transform. Each other locale repeats the same ~1,000 key names, which
// is dead weight once gzipped per-locale bundle: the key text doesn't need
// to travel more than once. So translators keep editing full nested JSON
// under source/ for readable diffs, and this script -- run before dev/build/
// test via npm's pre<script> hooks -- projects each locale onto en's key
// order and writes just the values. src/lib/i18n/hydrate.js reverses this at
// load time using en.json, which every locale already loads as the
// svelte-i18n fallback.
//
// Run standalone with `node scripts/build-locale-values.mjs` to regenerate
// without a full dev/build/test cycle.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { keyPaths } from '../src/lib/i18n/hydrate.js'

const i18nDir = fileURLToPath(new URL('../src/lib/i18n/', import.meta.url))
const locales = ['es', 'fr', 'hu']

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** Every leaf key path, keyed to its value, from the same traversal keyPaths() uses. */
function leafMap(obj, prefix = '') {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix + k
    if (v && typeof v === 'object') Object.assign(out, leafMap(v, path + '.'))
    else out[path] = v
  }
  return out
}

const en = loadJson(i18nDir + 'en.json')
const order = keyPaths(en)

for (const locale of locales) {
  const source = loadJson(i18nDir + `source/${locale}.json`)
  const leaves = leafMap(source)

  const sourcePaths = Object.keys(leaves)
  const missing = order.filter((p) => !(p in leaves))
  const extra = sourcePaths.filter((p) => !order.includes(p))
  if (missing.length || extra.length) {
    const detail = [
      missing.length ? `missing: ${missing.join(', ')}` : null,
      extra.length ? `extra: ${extra.join(', ')}` : null,
    ]
      .filter(Boolean)
      .join('; ')
    throw new Error(
      `src/lib/i18n/source/${locale}.json is out of sync with en.json (${detail}). ` +
        `Every key added to en.json must be added to every other catalog under source/.`,
    )
  }

  const values = order.map((path) => leaves[path])
  writeFileSync(i18nDir + `${locale}.json`, JSON.stringify(values))
}

console.log(`i18n: generated positional value arrays for ${locales.join(', ')} from source/`)
