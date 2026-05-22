// src/lib/config/firmware.js
// GitHub firmware-release helpers for the Firmware page.
import { compareVersion } from '../utils.js'

export const RELEASES_URL =
  'https://api.github.com/repos/OpenEVSE/ESP32_WiFi_V4.x/releases'

/** Fetch the GitHub releases. Returns [] on any failure (never throws). */
export async function fetchReleases() {
  try {
    const res = await fetch(RELEASES_URL)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/** Split releases into the stable / pre-release / daily channels. */
export function classifyReleases(releases) {
  const list = Array.isArray(releases) ? releases : []
  return {
    release: list.find((r) => r && r.prerelease === false) ?? null,
    prerelease:
      list.find(
        (r) => r && r.prerelease === true && /^v\d+\.\d+/.test(r.tag_name ?? ''),
      ) ?? null,
    daily: list.find((r) => r && r.tag_name === 'latest') ?? null,
  }
}

/** The release asset whose name starts with buildenv and ends with .bin. */
export function findAsset(release, buildenv) {
  if (!release || !Array.isArray(release.assets) || !buildenv) return null
  return (
    release.assets.find(
      (a) =>
        a &&
        typeof a.name === 'string' &&
        a.name.startsWith(buildenv) &&
        a.name.endsWith('.bin'),
    ) ?? null
  )
}

/** True only when `latestName` is a strictly newer parseable version. */
export function updateAvailable(latestName, installedVersion) {
  if (!latestName || !installedVersion) return false
  try {
    return compareVersion(latestName, installedVersion) === 1
  } catch {
    return false
  }
}
