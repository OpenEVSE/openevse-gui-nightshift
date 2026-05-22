// src/lib/config/rfid.js
// The device keeps registered RFID tags as one comma-separated string in
// config.rfid_storage. These helpers convert to/from a tag array.

export function parseTags(csv) {
  if (!csv || typeof csv !== 'string') return []
  return csv
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '')
}

export function serializeTags(tags) {
  return (tags ?? []).join(',')
}

export function addTag(tags, tag) {
  return tags.includes(tag) ? tags : [...tags, tag]
}

export function removeTag(tags, tag) {
  return tags.filter((t) => t !== tag)
}
