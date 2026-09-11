// Turns a flat array of translated values back into the nested dictionary
// svelte-i18n expects, using another locale's key order as the map.
//
// Why this exists: es/fr/hu each repeat the same ~1,000 key names as en, and
// those keys gzip-compress independently per locale bundle, so the key text
// itself was shipped four times. Storing es/fr/hu as value-only arrays (see
// scripts/build-locale-values.mjs) and re-deriving the shape from en.json's
// keys at load time removes that duplication — see the flash-budget note in
// the OpenEVSE firmware repo issue #1224.

// Separator for an encoded key path. A NUL byte never occurs in a JSON key we
// ship, so joining and splitting on it is unambiguous even if a key ever
// contained svelte-i18n's own nesting delimiter ('.'). The array-building
// script and this hydrator both import it, so position N always means the same
// key on both ends.
export const PATH_SEP = '\0'

/** Every [keyPath, value] leaf entry of a (possibly nested) translation
 * object, in a fixed depth-first, insertion-order traversal. This is the one
 * traversal both the array-building script and this hydrator rely on; keeping
 * it in a single place is what guarantees position N is the same key on both
 * ends. */
export function keyEntries(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keyEntries(v, prefix + k + PATH_SEP) : [[prefix + k, v]],
  )
}

/** Just the leaf key paths, in that same fixed traversal order. */
export function keyPaths(obj) {
  return keyEntries(obj).map(([path]) => path)
}

/** Rebuild a nested translation dictionary from a flat values array, using
 * keySource (typically en.json) for the shape and key order. */
export function hydrateLocale(keySource, values) {
  const paths = keyPaths(keySource)
  const out = {}
  paths.forEach((path, i) => {
    const parts = path.split(PATH_SEP)
    let node = out
    for (let j = 0; j < parts.length - 1; j++) {
      node = node[parts[j]] ??= {}
    }
    node[parts[parts.length - 1]] = values[i]
  })
  return out
}
