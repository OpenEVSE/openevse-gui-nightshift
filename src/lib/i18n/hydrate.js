// Turns a flat array of translated values back into the nested dictionary
// svelte-i18n expects, using another locale's key order as the map.
//
// Why this exists: es/fr/hu each repeat the same ~1,000 key names as en, and
// those keys gzip-compress independently per locale bundle, so the key text
// itself was shipped four times. Storing es/fr/hu as value-only arrays (see
// scripts/build-locale-values.mjs) and re-deriving the shape from en.json's
// keys at load time removes that duplication — see the flash-budget note in
// the OpenEVSE firmware repo issue #1224.

/** Every leaf key path in a (possibly nested) translation object, in a fixed
 * depth-first, insertion-order traversal. Both the array-building script and
 * this hydrator must walk keys in exactly this order for position N in the
 * values array to mean the same key on both ends. */
export function keyPaths(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keyPaths(v, prefix + k + '.') : [prefix + k],
  )
}

/** Rebuild a nested translation dictionary from a flat values array, using
 * keySource (typically en.json) for the shape and key order. */
export function hydrateLocale(keySource, values) {
  const paths = keyPaths(keySource)
  const out = {}
  paths.forEach((path, i) => {
    const parts = path.split('.')
    let node = out
    for (let j = 0; j < parts.length - 1; j++) {
      node = node[parts[j]] ??= {}
    }
    node[parts[parts.length - 1]] = values[i]
  })
  return out
}
