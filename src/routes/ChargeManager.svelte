<script>
  import { _ } from 'svelte-i18n'
  import { schedule_store } from '../lib/stores/schedule.js'
  import { limit_store } from '../lib/stores/limit.js'
  import { config_store } from '../lib/stores/config.js'
  import { override_store } from '../lib/stores/override.js'
  import { serialQueue } from '../lib/queue.js'
  import { showWriteError } from '../lib/alerts.js'
  import { DAYS } from '../lib/schedule/timers.js'
  import { timersToRules, rulesToTimers, ruleDeleteIds } from '../lib/charge_manager/rules.js'
  import GlobalSection from '../lib/components/charge_manager/GlobalSection.svelte'
  import ConditionalSection from '../lib/components/charge_manager/ConditionalSection.svelte'
  import GlobalFeaturePicker from '../lib/components/charge_manager/GlobalFeaturePicker.svelte'
  import DefaultStateCard from '../lib/components/charge_manager/DefaultStateCard.svelte'
  import RuleModal from '../lib/components/charge_manager/RuleModal.svelte'

  // ── Derived from stores ───────────────────────────────────────────────────
  let rules          = $derived(timersToRules(Array.isArray($schedule_store) ? $schedule_store : []))
  let limit          = $derived($limit_store ?? { type: 'none', value: 0, auto_release: true })
  let limitDefaultType  = $derived($config_store?.limit_default_type || 'none')
  let limitDefaultValue = $derived(Number($config_store?.limit_default_value ?? 0))
  let divertEnabled  = $derived(!!$config_store?.divert_enabled)
  let shapingEnabled = $derived(!!$config_store?.current_shaper_enabled)
  let rfidEnabled    = $derived(!!$config_store?.rfid_enabled)
  let ocppEnabled    = $derived(!!$config_store?.ocpp_enabled)
  let socAvailable    = $derived(!!$config_store?.mqtt_vehiclesoc)
  // default_state: true = Active on power-up, false = Disabled
  let defaultActive   = $derived($config_store?.default_state !== false)
  // Hardware current bounds (same as Settings > EVSE slider)
  let minCurrent      = $derived($config_store?.min_current_hard ?? 6)
  let maxCurrent      = $derived($config_store?.max_current_hard ?? 32)
  // Soft current limit = what the DefaultStateCard slider controls
  let defaultCurrent  = $derived($config_store?.max_current_soft ?? minCurrent)

  // Features ordered by claim priority (highest first):
  // shaping=1100/5000, session_limit=1100, ocpp=1050, rfid=1030, eco_divert=50
  const FEATURE_PRIORITY_ORDER = ['shaping', 'session_limit', 'ocpp', 'rfid', 'eco_divert']

  const FEATURE_ACTIVE = {
    shaping:       () => shapingEnabled,
    session_limit: () => limitDefaultType !== 'none',
    ocpp:          () => ocppEnabled,
    rfid:          () => rfidEnabled,
    eco_divert:    () => divertEnabled,
  }

  let enabledGlobalFeatures = $derived(
    FEATURE_PRIORITY_ORDER.filter((k) => FEATURE_ACTIVE[k]?.())
  )

  // ── UI state ──────────────────────────────────────────────────────────────
  let busy         = $state(false)
  let removingId   = $state(null)   // scheduled rule being deleted
  let removingKey  = $state(null)   // global feature being deleted
  let pickerOpen   = $state(false)
  let editorOpen   = $state(false)
  let editingRule  = $state(null)

  // ── Action mapping ────────────────────────────────────────────────────────
  function featureKeyToAction(key) {
    if (key === 'eco_divert') return 'eco_divert'
    if (key === 'shaping')    return 'shaper'
    if (key === 'rfid')       return 'rfid'
    if (key === 'ocpp')       return 'ocpp'
    return 'charge'  // session_limit
  }

  // ── Modal open ────────────────────────────────────────────────────────────
  /** Picker selected a key — open modal pre-configured. */
  function openPickerResult(key) {
    if (key === 'schedule') {
      editingRule = {
        id: null, alwaysOn: false, action: 'charge',
        days: [...DAYS], startTime: '08:00', stopTime: null,
        chargeCurrent: null, limit: null,
        _startEventId: null, _stopEventId: null,
      }
    } else {
      const action = featureKeyToAction(key)
      editingRule = {
        id: 'global_' + key, alwaysOn: true, action,
        days: [...DAYS], startTime: '00:00', stopTime: null,
        chargeCurrent: null,
        limit: key === 'session_limit' ? { type: 'time', value: 60 } : null,
        _startEventId: null, _stopEventId: null,
        _prevAction: action,
      }
    }
    editorOpen = true
  }

  /** Edit icon on a GlobalFeatureCard. */
  function openGlobalEdit(key) {
    const action = featureKeyToAction(key)
    editingRule = {
      id: 'global_' + key, alwaysOn: true, action,
      days: [...DAYS], startTime: '00:00', stopTime: null,
      chargeCurrent: null,
      limit: key === 'session_limit' ? { type: limitDefaultType, value: limitDefaultValue } : null,
      _startEventId: null, _stopEventId: null,
      _prevAction: action,
    }
    editorOpen = true
  }

  /** Edit icon on a RuleCard. */
  function openRuleEdit(rule) {
    editingRule = rule
    editorOpen = true
  }

  // ── Always-on API helpers ─────────────────────────────────────────────────
  async function applyAlwaysOnAction(action, rule) {
    switch (action) {
      case 'eco_divert':
        return await serialQueue.add(() => config_store.saveParam('divert_enabled', true))
      case 'shaper':
        return await serialQueue.add(() => config_store.saveParam('current_shaper_enabled', true))
      case 'rfid':
        return await serialQueue.add(() => config_store.saveParam('rfid_enabled', true))
      case 'ocpp':
        return await serialQueue.add(() => config_store.saveParam('ocpp_enabled', true))
      default: {
        let ok = true
        if (rule.limit && rule.limit.type !== 'none' && rule.limit.value > 0) {
          ok = await serialQueue.add(() =>
            config_store.saveParam('limit_default_type', rule.limit.type)
          )
          if (ok) ok = await serialQueue.add(() =>
            config_store.saveParam('limit_default_value', rule.limit.value)
          )
          if (ok) await serialQueue.add(() => limit_store.download())
        }
        return ok
      }
    }
  }

  async function clearAlwaysOnAction(action) {
    switch (action) {
      case 'eco_divert':
        return await serialQueue.add(() => config_store.saveParam('divert_enabled', false))
      case 'shaper':
        return await serialQueue.add(() => config_store.saveParam('current_shaper_enabled', false))
      case 'rfid':
        return await serialQueue.add(() => config_store.saveParam('rfid_enabled', false))
      case 'ocpp':
        return await serialQueue.add(() => config_store.saveParam('ocpp_enabled', false))
      default:
        await serialQueue.add(() => config_store.saveParam('limit_default_type', 'none'))
        await serialQueue.add(() => limit_store.remove())
        await serialQueue.add(() => override_store.removeProp('charge_current'))
        await serialQueue.add(() => limit_store.download())
        return true
    }
  }

  // ── Default state ─────────────────────────────────────────────────────────
  async function saveDefaultState(active) {
    if (busy) return
    busy = true
    try {
      const ok = await serialQueue.add(() => config_store.saveParam('default_state', active))
      if (!ok) showWriteError()
    } finally {
      busy = false
    }
  }

  async function saveDefaultCurrent(amps) {
    if (busy) return
    busy = true
    try {
      const ok = await serialQueue.add(() => config_store.saveParam('max_current_soft', amps))
      if (!ok) showWriteError()
    } finally {
      busy = false
    }
  }

  // ── Remove global feature (trash icon on GlobalFeatureCard) ───────────────
  async function removeGlobalFeature(key) {
    if (busy) return
    busy = true
    removingKey = key
    try {
      const ok = await clearAlwaysOnAction(featureKeyToAction(key))
      if (!ok) showWriteError()
    } finally {
      busy = false
      removingKey = null
    }
  }

  // ── Unified save from RuleModal ───────────────────────────────────────────
  async function saveCard(rule) {
    if (busy) return
    busy = true
    try {
      const wasGlobal    = typeof rule.id === 'string' && rule.id.startsWith('global_')
      const wasScheduled = typeof rule.id === 'string' && rule.id.startsWith('r_')

      if (rule.alwaysOn) {
        // Previously scheduled → delete timer pair
        if (wasScheduled) {
          for (const id of ruleDeleteIds(rule)) {
            const ok = await serialQueue.add(() => schedule_store.remove(id))
            if (!ok) { showWriteError(); return }
          }
          await serialQueue.add(() => schedule_store.download())
        }
        // Action changed on global card → clear old config
        if (wasGlobal && rule._prevAction && rule._prevAction !== rule.action) {
          await clearAlwaysOnAction(rule._prevAction)
        }
        const ok = await applyAlwaysOnAction(rule.action, rule)
        if (!ok) showWriteError()

      } else {
        // Switching from global → clear config first
        if (wasGlobal) {
          const ok = await clearAlwaysOnAction(rule._prevAction ?? rule.action)
          if (!ok) { showWriteError(); return }
        }
        // Write to /schedule
        const timers = Array.isArray($schedule_store) ? $schedule_store : []
        const { add, remove } = rulesToTimers(rule, timers)
        for (const id of remove) {
          const ok = await serialQueue.add(() => schedule_store.remove(id))
          if (!ok) { showWriteError(); return }
        }
        for (const timer of add) {
          const ok = await serialQueue.add(() => schedule_store.upload(timer))
          if (!ok) { showWriteError(); return }
        }
        await serialQueue.add(() => schedule_store.download())
      }
    } finally {
      busy = false
    }
  }

  // ── Delete scheduled rule ────────────────────────────────────────────────
  async function deleteRule(rule) {
    if (busy) return
    busy = true
    removingId = rule.id
    try {
      for (const id of ruleDeleteIds(rule)) {
        const ok = await serialQueue.add(() => schedule_store.remove(id))
        if (!ok) { showWriteError(); return }
      }
      await serialQueue.add(() => schedule_store.download())
    } finally {
      busy = false
      removingId = null
    }
  }
</script>

<section class="p-4 lg:mx-auto lg:max-w-3xl">
  <!-- Title row with Add button -->
  <div class="mb-5 flex items-center justify-between">
    <h1 class="text-lg font-semibold text-text">{$_('screen.charge_manager')}</h1>
    <button
      type="button"
      disabled={busy}
      onclick={() => (pickerOpen = true)}
      class="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white
             transition hover:opacity-90 disabled:opacity-40"
    >
      + {$_('charge_manager.global_add')}
    </button>
  </div>

  <DefaultStateCard
    active={defaultActive}
    current={defaultCurrent}
    {minCurrent}
    {maxCurrent}
    {busy}
    onchange={saveDefaultState}
    onCurrentChange={saveDefaultCurrent}
  />

  <GlobalSection
    enabledFeatures={enabledGlobalFeatures}
    {limit}
    {busy}
    {removingKey}
    onedit={openGlobalEdit}
    onremove={removeGlobalFeature}
  />

  <ConditionalSection
    {rules}
    removingId={removingId}
    {busy}
    onedit={openRuleEdit}
    ondelete={deleteRule}
  />
</section>

<GlobalFeaturePicker
  open={pickerOpen}
  enabledKeys={enabledGlobalFeatures}
  onpick={(key) => { openPickerResult(key); pickerOpen = false }}
  onclose={() => (pickerOpen = false)}
/>

<RuleModal
  open={editorOpen}
  rule={editingRule}
  {busy}
  {socAvailable}
  {minCurrent}
  {maxCurrent}
  onclose={() => (editorOpen = false)}
  onsave={(rule) => { editorOpen = false; saveCard(rule) }}
/>
