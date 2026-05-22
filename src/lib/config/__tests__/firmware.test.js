// src/lib/config/__tests__/firmware.test.js
import { describe, it, expect } from 'vitest'
import { classifyReleases, findAsset, updateAvailable } from '../firmware.js'

const RELEASES = [
  { tag_name: 'v5.1.2', name: 'v5.1.2', prerelease: false, assets: [
    { name: 'esp32-gw.bin', browser_download_url: 'u1' },
  ] },
  { tag_name: 'v5.2.0-rc1', name: 'v5.2.0-rc1', prerelease: true, assets: [] },
  { tag_name: 'latest', name: 'dev', prerelease: true, assets: [] },
]

describe('classifyReleases', () => {
  it('picks the stable, pre-release and daily entries', () => {
    const c = classifyReleases(RELEASES)
    expect(c.release.tag_name).toBe('v5.1.2')
    expect(c.prerelease.tag_name).toBe('v5.2.0-rc1')
    expect(c.daily.tag_name).toBe('latest')
  })
  it('returns nulls for an empty or non-array input', () => {
    expect(classifyReleases([])).toEqual({ release: null, prerelease: null, daily: null })
    expect(classifyReleases(undefined)).toEqual({ release: null, prerelease: null, daily: null })
  })
})

describe('findAsset', () => {
  it('matches an asset by buildenv prefix and .bin suffix', () => {
    expect(findAsset(RELEASES[0], 'esp32-gw').name).toBe('esp32-gw.bin')
  })
  it('returns null when nothing matches', () => {
    expect(findAsset(RELEASES[0], 'other-board')).toBe(null)
    expect(findAsset(RELEASES[1], 'esp32-gw')).toBe(null)
    expect(findAsset(null, 'esp32-gw')).toBe(null)
  })
})

describe('updateAvailable', () => {
  it('is true only when the latest is strictly newer', () => {
    expect(updateAvailable('v5.2.0', 'v5.1.2')).toBe(true)
    expect(updateAvailable('v5.1.2', 'v5.1.2')).toBe(false)
    expect(updateAvailable('v5.0.0', 'v5.1.2')).toBe(false)
  })
  it('is false for an unparseable installed version', () => {
    expect(updateAvailable('v5.2.0', 'local__abc_modified')).toBe(false)
    expect(updateAvailable('', 'v5.1.2')).toBe(false)
  })
})
