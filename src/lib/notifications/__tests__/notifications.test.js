import { describe, it, expect } from 'vitest'
import {
  SEVERITIES,
  ADVISORIES,
  KNOWN_ADVISORY_IDS,
  severityRank,
  maxSeverity,
  isKnownAdvisory,
  advisoryRoute,
  seenAt,
  normalizeNotifications,
  unmutedItems,
  criticalItems,
  sortNewestFirst,
  settingsMarkers,
  hasNotifications,
  badgeSignature,
} from '../notifications.js'

// A payload shaped exactly like Notifications::serialize() builds it.
function payload(items, extra = {}) {
  return {
    count: items.filter((n) => !n.acked).length,
    max_severity: 'critical',
    notifications: items,
    ...extra,
  }
}
function item(id, over = {}) {
  return {
    id,
    category: 'safety',
    severity: 'warning',
    sticky: true,
    acked: false,
    first_seen: 1779400000,
    last_seen: 1779400830,
    ...over,
  }
}

describe('severity', () => {
  it('ranks the three firmware severities in order', () => {
    expect(SEVERITIES).toEqual(['info', 'warning', 'critical'])
    expect(severityRank('info')).toBe(0)
    expect(severityRank('critical')).toBe(2)
  })

  it('ranks anything unrecognised lowest rather than throwing', () => {
    expect(severityRank('catastrophic')).toBe(0)
    expect(severityRank(undefined)).toBe(0)
  })

  it('reports the strongest severity in a list, info for an empty one', () => {
    expect(maxSeverity([])).toBe('info')
    expect(maxSeverity([{ severity: 'info' }, { severity: 'critical' }])).toBe('critical')
  })
})

describe('the advisory catalogue', () => {
  it('covers all sixteen ids the firmware can raise', () => {
    expect(KNOWN_ADVISORY_IDS).toHaveLength(16)
  })

  it('gives every safety advisory the config key of the switch it is about', () => {
    // The inline marker is the whole point of the feature; a safety advisory
    // with no switch to sit beside would be a dead end.
    for (const id of KNOWN_ADVISORY_IDS.filter((k) => k.startsWith('safety.'))) {
      expect(ADVISORIES[id].setting).toBeTruthy()
    }
  })

  it('sends relay wear to the health page, which already has the figures', () => {
    // "Do not restate relay numbers" — link there, never duplicate.
    for (const id of KNOWN_ADVISORY_IDS.filter((k) => k.startsWith('wear.'))) {
      expect(advisoryRoute(id)).toBe('/monitoring/health')
      expect(ADVISORIES[id].setting).toBeUndefined()
    }
  })

  it('carries no severity of its own', () => {
    // wear.relay_life and thermal.relay_thermal change severity with
    // condition, so it is read from the payload and never from a table.
    for (const entry of Object.values(ADVISORIES)) {
      expect(entry.severity).toBeUndefined()
    }
  })

  it('recognises known ids and refuses invented ones', () => {
    expect(isKnownAdvisory('safety.ground_check')).toBe(true)
    expect(isKnownAdvisory('safety.invented_check')).toBe(false)
    expect(advisoryRoute('safety.invented_check')).toBeNull()
    // Not fooled by Object.prototype members.
    expect(isKnownAdvisory('toString')).toBe(false)
  })
})

describe('seenAt', () => {
  it('reads a real epoch second', () => {
    expect(seenAt(1779400830)).toBe(1779400830)
  })

  it('treats 0 as unknown, never as 1970', () => {
    // 0 means the clock had not synced when the charger recorded this.
    expect(seenAt(0)).toBeNull()
  })

  it('treats missing or unusable values as unknown', () => {
    expect(seenAt(undefined)).toBeNull()
    expect(seenAt(null)).toBeNull()
    expect(seenAt('soon')).toBeNull()
    expect(seenAt(-5)).toBeNull()
  })
})

describe('normalizeNotifications', () => {
  it('keeps the firmware\'s own badge figures', () => {
    const out = normalizeNotifications(payload([item('safety.ground_check')]))
    expect(out.count).toBe(1)
    expect(out.severity).toBe('critical')
    expect(out.items).toHaveLength(1)
  })

  it('accepts count 0 beside a non-empty list', () => {
    // Every item muted: the badge is silent, the list is not empty. The
    // handoff calls this out specifically as not-a-bug.
    const out = normalizeNotifications({
      count: 0,
      max_severity: 'info',
      notifications: [item('safety.vent_check', { acked: true })],
    })
    expect(out.count).toBe(0)
    expect(out.items).toHaveLength(1)
    expect(out.items[0].acked).toBe(true)
  })

  it('converts unknown timestamps to null on the way in', () => {
    const out = normalizeNotifications(
      payload([item('thermal.relay_thermal', { first_seen: 0, last_seen: 0 })]),
    )
    expect(out.items[0].first_seen).toBeNull()
    expect(out.items[0].last_seen).toBeNull()
  })

  it('recomputes the badge only when the firmware did not supply it', () => {
    const out = normalizeNotifications({
      notifications: [
        item('safety.ground_check', { severity: 'critical' }),
        item('safety.vent_check', { acked: true, severity: 'warning' }),
      ],
    })
    expect(out.count).toBe(1)
    expect(out.severity).toBe('critical')
  })

  it('survives every shape a failed request can produce', () => {
    for (const bad of [null, undefined, 'error', 42, [], {}]) {
      const out = normalizeNotifications(bad)
      expect(out).toEqual({ count: 0, severity: 'info', items: [] })
    }
  })

  it('drops entries with no usable id and defaults an unknown severity', () => {
    const out = normalizeNotifications({
      notifications: [
        { id: '' },
        null,
        { id: 'safety.ground_check', severity: 'apocalyptic' },
      ],
    })
    expect(out.items).toHaveLength(1)
    expect(out.items[0].severity).toBe('info')
  })
})

describe('list slicing', () => {
  const items = [
    item('safety.ground_check', { severity: 'critical', acked: false }),
    item('safety.vent_check', { severity: 'warning', acked: true }),
    item('fault.gfci_tripped', { severity: 'critical', acked: true }),
  ]

  it('counts only unmuted entries', () => {
    expect(unmutedItems(items).map((n) => n.id)).toEqual(['safety.ground_check'])
  })

  it('shows only unmuted criticals on the status strip', () => {
    // A muted critical stays in the list and keeps its marker, but it must
    // not put the loudest thing in the UI back on screen.
    expect(criticalItems(items).map((n) => n.id)).toEqual(['safety.ground_check'])
  })
})

describe('sortNewestFirst', () => {
  it('orders by when the advisory was raised, newest first', () => {
    const out = sortNewestFirst([
      item('a', { first_seen: 100 }),
      item('b', { first_seen: 300 }),
      item('c', { first_seen: 200 }),
    ])
    expect(out.map((n) => n.id)).toEqual(['b', 'c', 'a'])
  })

  it('puts unknown timestamps last, not first', () => {
    // first_seen 0 normalises to null; sorting it as a number would float it
    // to the top as the oldest thing the charger ever saw.
    const out = sortNewestFirst([
      item('unknown', { first_seen: null, last_seen: null }),
      item('dated', { first_seen: 100 }),
    ])
    expect(out.map((n) => n.id)).toEqual(['dated', 'unknown'])
  })

  it('breaks ties by severity then id, so the order is stable', () => {
    const out = sortNewestFirst([
      item('b.quiet', { first_seen: 100, severity: 'info' }),
      item('a.loud', { first_seen: 100, severity: 'critical' }),
      item('a.quiet', { first_seen: 100, severity: 'info' }),
    ])
    expect(out.map((n) => n.id)).toEqual(['a.loud', 'a.quiet', 'b.quiet'])
  })

  it('does not mutate its input', () => {
    const input = [item('a', { first_seen: 100 }), item('b', { first_seen: 300 })]
    sortNewestFirst(input)
    expect(input.map((n) => n.id)).toEqual(['a', 'b'])
  })
})

describe('settingsMarkers', () => {
  it('maps a safety advisory onto the config key of its switch', () => {
    const markers = settingsMarkers([item('safety.ground_check', { severity: 'critical' })])
    expect(markers.ground_check).toEqual({
      id: 'safety.ground_check',
      severity: 'critical',
      acked: false,
    })
  })

  it('still marks a muted advisory', () => {
    // Acking silences the alarm; it never hides the state. The owner who
    // muted "ground check is off" still sees it beside the switch.
    const markers = settingsMarkers([item('safety.vent_check', { acked: true })])
    expect(markers.vent_check.acked).toBe(true)
  })

  it('ignores advisories that name no switch', () => {
    expect(settingsMarkers([item('wear.relay_life'), item('fault.no_ground')])).toEqual({})
  })

  it('survives an empty or absent list', () => {
    expect(settingsMarkers([])).toEqual({})
    expect(settingsMarkers(undefined)).toEqual({})
  })
})

describe('the capability gate', () => {
  it('is the presence of the notifications object, never its contents', () => {
    // A charger with nothing to report still says so.
    expect(hasNotifications({ notifications: { count: 0, severity: 'info' } })).toBe(true)
    expect(hasNotifications({ notifications: { count: 3, severity: 'critical' } })).toBe(true)
  })

  it('is closed on firmware that predates advisories', () => {
    expect(hasNotifications({ state: 1 })).toBe(false)
    expect(hasNotifications(null)).toBe(false)
    expect(hasNotifications(undefined)).toBe(false)
  })

  it('is not opened by something that merely shares the name', () => {
    expect(hasNotifications({ notifications: [] })).toBe(false)
    expect(hasNotifications({ notifications: 2 })).toBe(false)
  })
})

describe('badgeSignature', () => {
  it('is null on a build with no advisory engine', () => {
    // DataManager reads null as "leave the store idle", which keeps the bell,
    // the strip and the markers off an old charger entirely.
    expect(badgeSignature({ state: 1 })).toBeNull()
  })

  it('moves when either field moves', () => {
    const a = badgeSignature({ notifications: { count: 2, severity: 'warning' } })
    const b = badgeSignature({ notifications: { count: 2, severity: 'critical' } })
    const c = badgeSignature({ notifications: { count: 3, severity: 'warning' } })
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
  })

  it('is stable while nothing moves, so it does not re-fetch on every frame', () => {
    const status = { notifications: { count: 2, severity: 'warning' } }
    expect(badgeSignature(status)).toBe(badgeSignature({ ...status }))
  })

  it('is a string for a quiet charger, not null', () => {
    // count 0 is still a yes to the capability question.
    expect(badgeSignature({ notifications: { count: 0, severity: 'info' } })).toBe('0:info')
  })
})
