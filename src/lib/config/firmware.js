// src/lib/config/firmware.js
// GitHub firmware-release helpers for the Firmware page.
import { compareVersion } from '../utils.js'

const RELEASES_URL =
  'https://api.github.com/repos/OpenEVSE/openevse_esp32_firmware/releases'

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

/**
 * The release asset named exactly `${buildenv}.bin`. A prefix match would also
 * pick e.g. `openevse_wifi_v1_16mb.bin` for `openevse_wifi_v1`, and flashing a
 * 16MB-layout image onto a 4MB board can brick it.
 */
export function findAsset(release, buildenv) {
  if (!release || !Array.isArray(release.assets) || !buildenv) return null
  const name = `${buildenv}.bin`
  return release.assets.find((a) => a && a.name === name) ?? null
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
