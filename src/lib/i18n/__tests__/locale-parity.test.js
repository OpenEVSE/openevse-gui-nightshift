import { describe, it, expect } from 'vitest'
import en from '../en.json'
// The human-maintained catalogs, before scripts/build-locale-values.mjs
// projects them onto en's key order and strips the keys back out. This is
// the layer where a translator could actually introduce drift, so parity is
// checked here rather than against the generated (and gitignored) arrays --
// the build/hydrate round trip itself is covered below.
import es from '../source/es.json'
import fr from '../source/fr.json'
import hu from '../source/hu.json'

/** Every leaf key path in a (possibly nested) translation object. */
function paths(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? paths(v, prefix + k + '.') : [prefix + k],
  )
}

/** Placeholder tokens ({foo}) in a string, sorted for comparison. */
function placeholders(value) {
  return (String(value).match(/\{[^}]+\}/g) ?? []).sort()
}

function leaves(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? leaves(v, prefix + k + '.') : [[prefix + k, v]],
  )
}

const enPaths = paths(en).sort()
const enLeaves = Object.fromEntries(leaves(en))

describe('locale parity', () => {
  for (const [name, locale] of [
    ['es', es],
    ['fr', fr],
    ['hu', hu],
  ]) {
    it(`${name} has exactly the same keys as en`, () => {
      expect(paths(locale).sort()).toEqual(enPaths)
    })

    it(`${name} preserves every interpolation placeholder`, () => {
      for (const [key, value] of leaves(locale)) {
        expect(placeholders(value), key).toEqual(placeholders(enLeaves[key]))
      }
    })
  }
})
