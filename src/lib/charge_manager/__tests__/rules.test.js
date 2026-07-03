import { describe, it, expect } from 'vitest'
import {
  timersToRules,
  rulesToTimers,
  ruleDeleteIds,
  actionToTimerState,
  actionToFeatureKey,
  timerStateToAction,
  formatWindow,
} from '../rules.js'

// ── helpers ──────────────────────────────────────────────────────────────────

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const weekend = ['saturday', 'sunday']
const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function timer(id, time, state, days = allDays) {
  return { id, time, state, days }
}

// ── actionToTimerState / timerStateToAction ───────────────────────────────────

describe('actionToTimerState', () => {
  it('maps charge → active', () => expect(actionToTimerState('charge')).toBe('active'))
  it('maps eco → active (eco uses divert feature, not native eco state)', () => expect(actionToTimerState('eco')).toBe('active'))
  it('maps eco_divert → active', () => expect(actionToTimerState('eco_divert')).toBe('active'))
  it('maps disable → disabled', () => expect(actionToTimerState('disable')).toBe('disabled'))
  it('maps unknown → active', () => expect(actionToTimerState('whatever')).toBe('active'))
})

describe('actionToFeatureKey', () => {
  it('maps eco_divert → eco_divert', () => expect(actionToFeatureKey('eco_divert')).toBe('eco_divert'))
  it('maps shaper → shaping', () => expect(actionToFeatureKey('shaper')).toBe('shaping'))
  it('maps rfid → rfid', () => expect(actionToFeatureKey('rfid')).toBe('rfid'))
  it('maps ocpp → ocpp', () => expect(actionToFeatureKey('ocpp')).toBe('ocpp'))
  it('returns null for charge (no on/off global feature)', () => expect(actionToFeatureKey('charge')).toBeNull())
  it('returns null for disable', () => expect(actionToFeatureKey('disable')).toBeNull())
})

describe('timerStateToAction', () => {
  it('maps active (no feature) → charge', () => expect(timerStateToAction('active')).toBe('charge'))
  it('maps active + feature=divert → eco_divert', () => expect(timerStateToAction('active', 'divert')).toBe('eco_divert'))
  it('maps active + feature=shaper → shaper', () => expect(timerStateToAction('active', 'shaper')).toBe('shaper'))
  it('maps active + feature=rfid → rfid', () => expect(timerStateToAction('active', 'rfid')).toBe('rfid'))
  it('maps active + feature=ocpp → ocpp', () => expect(timerStateToAction('active', 'ocpp')).toBe('ocpp'))
  it('maps disabled → disable', () => expect(timerStateToAction('disabled')).toBe('disable'))
  it('maps eco state (old format) → eco_divert for backward compat', () => expect(timerStateToAction('eco')).toBe('eco_divert'))
})

// ── timersToRules ─────────────────────────────────────────────────────────────

describe('timersToRules', () => {
  it('returns [] for empty input', () => {
    expect(timersToRules([])).toEqual([])
    expect(timersToRules(undefined)).toEqual([])
  })

  it('single active timer → standalone charge rule (no stop)', () => {
    const rules = timersToRules([timer(1, '08:00', 'active', weekdays)])
    expect(rules).toHaveLength(1)
    expect(rules[0].action).toBe('charge')
    expect(rules[0].startTime).toBe('08:00')
    expect(rules[0].stopTime).toBeNull()
    expect(rules[0]._startEventId).toBe(1)
    expect(rules[0]._stopEventId).toBeNull()
  })

  it('single eco timer (old format) → standalone eco_divert rule', () => {
    const rules = timersToRules([timer(2, '13:00', 'eco', weekdays)])
    expect(rules[0].action).toBe('eco_divert')
  })

  it('single disabled timer → standalone disable rule', () => {
    const rules = timersToRules([timer(3, '18:00', 'disabled', weekdays)])
    expect(rules[0].action).toBe('disable')
    expect(rules[0].stopTime).toBeNull()
  })

  it('active + disabled on same days → paired window rule', () => {
    const rules = timersToRules([
      timer(1, '13:00', 'active', weekdays),
      timer(2, '18:00', 'disabled', weekdays),
    ])
    expect(rules).toHaveLength(1)
    expect(rules[0].action).toBe('charge')
    expect(rules[0].startTime).toBe('13:00')
    expect(rules[0].stopTime).toBe('18:00')
    expect(rules[0]._startEventId).toBe(1)
    expect(rules[0]._stopEventId).toBe(2)
  })

  it('eco state (old format) + disabled on same days → paired eco_divert window rule', () => {
    const rules = timersToRules([
      timer(1, '13:00', 'eco', weekdays),
      timer(2, '18:00', 'disabled', weekdays),
    ])
    expect(rules).toHaveLength(1)
    expect(rules[0].action).toBe('eco_divert')
    expect(rules[0].stopTime).toBe('18:00')
  })

  it('active + disabled on DIFFERENT days → two separate standalone rules', () => {
    const rules = timersToRules([
      timer(1, '08:00', 'active', weekdays),
      timer(2, '18:00', 'disabled', weekend),
    ])
    expect(rules).toHaveLength(2)
    expect(rules[0].stopTime).toBeNull()
    expect(rules[1].stopTime).toBeNull()
  })

  it('two active timers on different day sets → two separate rules', () => {
    const rules = timersToRules([
      timer(1, '08:00', 'active', weekdays),
      timer(2, '10:00', 'active', weekend),
    ])
    expect(rules).toHaveLength(2)
    expect(rules.every((r) => r.stopTime === null)).toBe(true)
  })

  it('reads new flat limit/feature fields from timer event', () => {
    const t = { id: 1, time: '13:00', state: 'active', days: weekdays, feature: 'current', feature_value: 16, limit: 'energy', limit_value: 10000 }
    const rules = timersToRules([t])
    expect(rules[0].limit).toEqual({ type: 'energy', value: 10000 })
    expect(rules[0].chargeCurrent).toBe(16)
  })

  it('reads feature=divert from timer event → eco_divert action', () => {
    const t = { id: 1, time: '13:00', state: 'active', days: weekdays, feature: 'divert', feature_value: 1 }
    const rules = timersToRules([t])
    expect(rules[0].action).toBe('eco_divert')
    expect(rules[0].chargeCurrent).toBeNull()
  })

  it('timers fed out-of-order are sorted before pairing', () => {
    const rules = timersToRules([
      timer(2, '18:00', 'disabled', weekdays),
      timer(1, '08:00', 'active', weekdays),
    ])
    expect(rules).toHaveLength(1)
    expect(rules[0].startTime).toBe('08:00')
    expect(rules[0].stopTime).toBe('18:00')
  })

  it('does not pair a disabled timer that comes BEFORE an active one', () => {
    // disabled at 06:00, active at 08:00 — the disabled can't be a stop for the active
    const rules = timersToRules([
      timer(1, '06:00', 'disabled', weekdays),
      timer(2, '08:00', 'active', weekdays),
    ])
    expect(rules).toHaveLength(2)
  })

  it('each disabled timer is only consumed once as a stop', () => {
    // Two active timers chasing one disabled timer — first wins, second is standalone
    const rules = timersToRules([
      timer(1, '08:00', 'active', weekdays),
      timer(2, '10:00', 'active', weekdays),
      timer(3, '18:00', 'disabled', weekdays),
    ])
    expect(rules).toHaveLength(2)
    const paired = rules.find((r) => r.stopTime !== null)
    const standalone = rules.find((r) => r.stopTime === null)
    expect(paired).toBeDefined()
    expect(standalone).toBeDefined()
  })

  it('rule id is derived from start timer id', () => {
    const rules = timersToRules([timer(42, '08:00', 'active', allDays)])
    expect(rules[0].id).toBe('r_42')
  })

  it('pairs active at 23:00 weekdays with disabled at 06:00 on shifted (Tue–Sat) days', () => {
    const shiftedWeekdays = ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const rules = timersToRules([
      timer(1, '23:00', 'active', weekdays),
      timer(2, '06:00', 'disabled', shiftedWeekdays),
    ])
    expect(rules).toHaveLength(1)
    expect(rules[0].startTime).toBe('23:00')
    expect(rules[0].stopTime).toBe('06:00')
    expect(rules[0]._startEventId).toBe(1)
    expect(rules[0]._stopEventId).toBe(2)
  })

  it('next-day stop that arrives earlier in sort order is still paired correctly', () => {
    // stop at 06:00 sorted before start at 23:00, but two-phase algorithm still pairs them
    const shiftedWeekdays = ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const rules = timersToRules([
      timer(2, '06:00', 'disabled', shiftedWeekdays),
      timer(1, '23:00', 'active', weekdays),
    ])
    expect(rules).toHaveLength(1)
    expect(rules[0].stopTime).toBe('06:00')
  })

  it('does NOT swallow a standalone disable rule as a next-day stop when its time is after the start', () => {
    // "Charge from Monday 08:00" + separate "disable on Tuesday 09:00" rule.
    // Tuesday equals shiftDaysForward([monday]) but 09:00 can't be a wrapped
    // stop for an 08:00 start — a next-day stop is always <= the start time.
    const rules = timersToRules([
      timer(1, '08:00', 'active', ['monday']),
      timer(5, '09:00', 'disabled', ['tuesday']),
    ])
    expect(rules).toHaveLength(2)
    expect(rules.every((r) => r.stopTime === null)).toBe(true)
  })

  it('prefers the id-adjacent stop when several disabled timers share the day set', () => {
    // Two identical next-day stops; id 2 is the one rulesToTimers wrote for id 1.
    const shiftedWeekdays = ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const rules = timersToRules([
      timer(7, '06:00', 'disabled', shiftedWeekdays),
      timer(2, '06:00', 'disabled', shiftedWeekdays),
      timer(1, '23:00', 'active', weekdays),
    ])
    const paired = rules.find((r) => r._startEventId === 1)
    expect(paired._stopEventId).toBe(2)
    // the non-adjacent stop stays a standalone disable rule
    expect(rules.find((r) => r._startEventId === 7)).toBeDefined()
  })

  it('id-adjacent pairing is resolved before a time-sorted rule can steal the stop', () => {
    // Both actives share days; the stop is id-adjacent to the SECOND active.
    const rules = timersToRules([
      timer(1, '08:00', 'active', weekdays),
      timer(3, '10:00', 'active', weekdays),
      timer(4, '18:00', 'disabled', weekdays),
    ])
    expect(rules.find((r) => r._startEventId === 3)._stopEventId).toBe(4)
    expect(rules.find((r) => r._startEventId === 1)._stopEventId).toBeNull()
  })

  it('does not pair a feature rule with a plain disabled timer (stop must carry the feature)', () => {
    const start = { id: 1, time: '13:00', state: 'active', days: weekdays, feature: 'divert', feature_value: 1 }
    const rules = timersToRules([start, timer(9, '18:00', 'disabled', weekdays)])
    expect(rules).toHaveLength(2)
    expect(rules.find((r) => r._startEventId === 1).stopTime).toBeNull()
  })

  it('pairs a feature rule with its feature-carrying stop', () => {
    const start = { id: 1, time: '13:00', state: 'active', days: weekdays, feature: 'divert', feature_value: 1 }
    const stop  = { id: 2, time: '18:00', state: 'disabled', days: weekdays, feature: 'divert', feature_value: 0 }
    const rules = timersToRules([start, stop])
    expect(rules).toHaveLength(1)
    expect(rules[0].action).toBe('eco_divert')
    expect(rules[0]._stopEventId).toBe(2)
  })

  it('charge rule with a current feature pairs with a plain stop', () => {
    // 'current' lives only on the start timer; its stop is written plain.
    const start = { id: 1, time: '13:00', state: 'active', days: weekdays, feature: 'current', feature_value: 16 }
    const rules = timersToRules([start, timer(2, '18:00', 'disabled', weekdays)])
    expect(rules).toHaveLength(1)
    expect(rules[0].chargeCurrent).toBe(16)
    expect(rules[0]._stopEventId).toBe(2)
  })

  it('round-trips a rule written by rulesToTimers back to the same pairing', () => {
    const rule = {
      id: null, alwaysOn: false, days: weekdays, startTime: '22:00', stopTime: '04:00',
      action: 'eco_divert', chargeCurrent: null, limit: null,
      _startEventId: null, _stopEventId: null,
    }
    const existing = [timer(1, '09:00', 'active', weekend), timer(2, '17:00', 'disabled', weekend)]
    const { add } = rulesToTimers(rule, existing)
    const rules = timersToRules([...existing, ...add])
    expect(rules).toHaveLength(2)
    const rt = rules.find((r) => r.action === 'eco_divert')
    expect(rt.startTime).toBe('22:00')
    expect(rt.stopTime).toBe('04:00')
    expect(rt._startEventId).toBe(add[0].id)
    expect(rt._stopEventId).toBe(add[1].id)
  })
})

// ── rulesToTimers ─────────────────────────────────────────────────────────────

describe('rulesToTimers', () => {
  const baseRule = {
    id: 'r_1',
    days: weekdays,
    startTime: '08:00',
    stopTime: null,
    action: 'charge',
    chargeCurrent: null,
    limit: null,
    _startEventId: null,
    _stopEventId: null,
  }

  it('new rule with no stop → one timer added, none removed', () => {
    const { add, remove } = rulesToTimers(baseRule, [])
    expect(add).toHaveLength(1)
    expect(remove).toHaveLength(0)
    expect(add[0].state).toBe('active')
    expect(add[0].time).toBe('08:00')
    expect(add[0].days).toEqual(weekdays)
  })

  it('new rule with stop time → two timers added', () => {
    const rule = { ...baseRule, stopTime: '18:00' }
    const { add, remove } = rulesToTimers(rule, [])
    expect(add).toHaveLength(2)
    expect(add[0].state).toBe('active')
    expect(add[1].state).toBe('disabled')
    expect(add[1].time).toBe('18:00')
    expect(remove).toHaveLength(0)
  })

  it('edited rule retains existing timer IDs', () => {
    const rule = { ...baseRule, _startEventId: 5, stopTime: '20:00', _stopEventId: 6 }
    const { add, remove } = rulesToTimers(rule, [{ id: 5 }, { id: 6 }])
    expect(add[0].id).toBe(5)
    expect(add[1].id).toBe(6)
    expect(remove).toHaveLength(0)
  })

  it('removing stop time from edited rule deletes stop event', () => {
    const rule = { ...baseRule, _startEventId: 5, stopTime: null, _stopEventId: 6 }
    const { add, remove } = rulesToTimers(rule, [{ id: 5 }, { id: 6 }])
    expect(remove).toContain(6)
    expect(add).toHaveLength(1)
  })

  it('limit is serialized into start timer as flat fields', () => {
    const rule = { ...baseRule, limit: { type: 'energy', value: 10000 } }
    const { add } = rulesToTimers(rule, [])
    expect(add[0].limit).toBe('energy')
    expect(add[0].limit_value).toBe(10000)
  })

  it('eco action maps to active state + divert feature', () => {
    const rule = { ...baseRule, action: 'eco' }
    const { add } = rulesToTimers(rule, [])
    expect(add[0].state).toBe('active')
    expect(add[0].feature).toBe('divert')
    expect(add[0].feature_value).toBe(1)
  })

  it('eco_divert action maps to active state + divert feature', () => {
    const rule = { ...baseRule, action: 'eco_divert' }
    const { add } = rulesToTimers(rule, [])
    expect(add[0].state).toBe('active')
    expect(add[0].feature).toBe('divert')
    expect(add[0].feature_value).toBe(1)
  })

  it('stop timer for eco_divert rule includes feature + feature_value=0', () => {
    const rule = { ...baseRule, action: 'eco_divert', stopTime: '18:00' }
    const { add } = rulesToTimers(rule, [])
    expect(add[1].state).toBe('disabled')
    expect(add[1].feature).toBe('divert')
    expect(add[1].feature_value).toBe(0)
  })

  it('same-day stop timer uses original days unchanged', () => {
    const rule = { ...baseRule, startTime: '08:00', stopTime: '18:00' }
    const { add } = rulesToTimers(rule, [])
    expect(add[1].days).toEqual(weekdays)
  })

  it('next-day stop timer uses days shifted forward by one', () => {
    const rule = { ...baseRule, days: weekdays, startTime: '23:00', stopTime: '06:00' }
    const { add } = rulesToTimers(rule, [])
    expect(add[0].days).toEqual(weekdays)
    expect(add[1].days).toEqual(['tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])
  })

  it('next-day stop timer for weekend shifts Sat→Sun and Sun→Mon', () => {
    const rule = { ...baseRule, days: weekend, startTime: '22:00', stopTime: '02:00' }
    const { add } = rulesToTimers(rule, [])
    expect(add[1].days).toEqual(['sunday', 'monday'])
  })

  it('disable action maps to disabled state', () => {
    const rule = { ...baseRule, action: 'disable' }
    const { add } = rulesToTimers(rule, [])
    expect(add[0].state).toBe('disabled')
  })

  it('new IDs avoid collisions with existing timer IDs', () => {
    const existing = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const { add } = rulesToTimers({ ...baseRule, stopTime: '18:00' }, existing)
    expect(add[0].id).toBe(4)
    expect(add[1].id).toBe(5)
  })
})

// ── ruleDeleteIds ─────────────────────────────────────────────────────────────

describe('ruleDeleteIds', () => {
  it('returns both IDs for a paired rule', () => {
    expect(ruleDeleteIds({ _startEventId: 3, _stopEventId: 4 })).toEqual([3, 4])
  })
  it('returns only start ID for standalone rule', () => {
    expect(ruleDeleteIds({ _startEventId: 3, _stopEventId: null })).toEqual([3])
  })
  it('handles null start gracefully', () => {
    expect(ruleDeleteIds({ _startEventId: null, _stopEventId: null })).toEqual([])
  })
})

// ── formatWindow ──────────────────────────────────────────────────────────────

describe('formatWindow', () => {
  it('formats a range as "1:00 PM – 6:00 PM"', () => {
    expect(formatWindow('13:00', '18:00')).toBe('1:00 PM – 6:00 PM')
  })
  it('formats a standalone start as "from 8:00 AM"', () => {
    expect(formatWindow('08:00', null)).toBe('from 8:00 AM')
  })
  it('handles midnight', () => {
    expect(formatWindow('00:00', null)).toBe('from 12:00 AM')
  })
  it('handles noon', () => {
    expect(formatWindow('12:00', null)).toBe('from 12:00 PM')
  })
  it('appends (next day) when stop is before start', () => {
    expect(formatWindow('23:00', '06:00')).toBe('11:00 PM – 6:00 AM (next day)')
  })
})
