<script>
  import { _ } from 'svelte-i18n'
  import { schedule_store } from '../lib/stores/schedule.js'
  import { limit_store } from '../lib/stores/limit.js'
  import { config_store } from '../lib/stores/config.js'
  import { status_store } from '../lib/stores/status.js'
  import { override_store } from '../lib/stores/override.js'
  import { claims_target_store } from '../lib/stores/claims_target.js'
  import { claims_store } from '../lib/stores/claims.js'
  import { plan_store } from '../lib/stores/plan.js'
  import { claimRows } from '../lib/monitoring/metrics.js'
  import { serialQueue } from '../lib/queue.js'
  import { showWriteError } from '../lib/alerts.js'
  import { DAYS } from '../lib/schedule/timers.js'
  import { timersToRules, rulesToTimers, ruleDeleteIds, actionToFeatureKey } from '../lib/charge_manager/rules.js'
  import { allRequiredSafetyChecksOn } from '../lib/config/safety.js'
  import GlobalSection from '../lib/components/charge_manager/GlobalSection.svelte'
  import ConditionalSection from '../lib/components/charge_manager/ConditionalSection.svelte'
  import GlobalFeaturePicker from '../lib/components/charge_manager/GlobalFeaturePicker.svelte'
  import DefaultStateCard from '../lib/components/charge_manager/DefaultStateCard.svelte'
  import DefaultStateSettingsModal from '../lib/components/charge_manager/DefaultStateSettingsModal.svelte'
  import RuleModal from '../lib/components/charge_manager/RuleModal.svelte'
  import ManagerTab from '../lib/components/monitoring/ManagerTab.svelte'

  // ── Derived from stores ───────────────────────────────────────────────────
  let rules          = $derived(timersToRules(Array.isArray($schedule_store) ? $schedule_store : []))
  // Map each client id to its actual runtime claim priority (from /claims), so
  // the Claims Manager shows the real priority (e.g. timer shaper = 1100).
  let priorityByClient = $derived(
    Array.isArray($claims_store)
      ? Object.fromEntries($claims_store.map((c) => [c.client, c.priority]))
      : {}
  )
  let claims         = $derived(claimRows($claims_target_store, priorityByClient))
  // Firmware's currently-active schedule event (drives the rule's Active badge).
  let activeEventId  = $derived($plan_store?.current_event?.id ?? null)
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

  // Safety toggles on the Default State card (only when firmware exposes them)
  let heartbeatSupported = $derived($config_store?.heartbeat_interval !== undefined)
  let heartbeatEnabled   = $derived(($config_store?.heartbeat_interval ?? 0) > 0)
  // Panel defaults: interval 5, fail current 6 when unset/zeroed.
  let heartbeatInterval  = $derived($config_store?.heartbeat_interval || 5)
  let heartbeatCurrent   = $derived($config_store?.heartbeat_current || 6)
  let bootLockSupported  = $derived($config_store?.boot_lock !== undefined)
  let bootLock           = $derived(!!$config_store?.boot_lock)

  // Temperature protection — combined throttle/panic slider at the top of the
  // Always Active section, shown only when throttling is enabled.
  let tempThrottleEnabled  = $derived(!!$config_store?.temp_throttle_enabled)
  let panicSupported       = $derived($config_store?.over_temp_shutdown !== undefined)
  // EVSE temperature is reported in tenths of °C.
  let evseTemperature = $derived(
    typeof $status_store?.temp === 'number' ? $status_store.temp / 10 : null
  )
  let tempProtection = $derived(
    (tempThrottleEnabled && panicSupported)
      ? {
          throttle: $config_store?.temp_throttle_setpoint ?? 65,
          panic:    $config_store?.over_temp_shutdown ?? 72,
          min: 40,
          max: 82,
          checksAllOn: allRequiredSafetyChecksOn($config_store),
          temperature: evseTemperature,
        }
      : null
  )

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

  // OCPP needs a server configured; RFID needs a reader on the I2C bus. Used to
  // grey these out in both the feature picker and the Edit Rule action list.
  let ocppAvailable = $derived(!!$config_store?.ocpp_server)
  let rfidAvailable = $derived(!!$status_store?.rfid_reader)
  let pickerUnavailable = $derived({
    ...(ocppAvailable ? {} : { ocpp: 'charge_manager.feature_ocpp_unavailable' }),
    ...(rfidAvailable ? {} : { rfid: 'charge_manager.feature_rfid_unavailable' }),
  })

  // ── UI state ──────────────────────────────────────────────────────────────
  let busy         = $state(false)
  let removingId   = $state(null)   // scheduled rule being deleted
  let removingKey  = $state(null)   // global feature being deleted
  let pickerOpen   = $state(false)
  let editorOpen   = $state(false)
  let editingRule  = $state(null)
  let settingsOpen = $state(false)   // Default State settings page

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
        // Session limit: a missing/zero limit writes nothing — report it as a
        // failure instead of pretending the save happened. (The modal already
        // validates this; this is the backstop.)
        if (!(rule.limit && rule.limit.type !== 'none' && rule.limit.value > 0)) return false
        let ok = await serialQueue.add(() =>
          config_store.saveParam('limit_default_type', rule.limit.type)
        )
        if (ok) ok = await serialQueue.add(() =>
          config_store.saveParam('limit_default_value', rule.limit.value)
        )
        if (ok) await serialQueue.add(() => limit_store.download())
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
      default: {
        // Report config/limit write failures; removeProp stays best-effort —
        // it returns false for the common no-override-set case too.
        let ok = await serialQueue.add(() => config_store.saveParam('limit_default_type', 'none'))
        if (!(await serialQueue.add(() => limit_store.remove()))) ok = false
        await serialQueue.add(() => override_store.removeProp('charge_current'))
        await serialQueue.add(() => limit_store.download())
        return ok
      }
    }
  }

  // ── Single-param config save (busy-guarded) ───────────────────────────────
  async function saveConfigParam(name, val) {
    if (busy) return
    busy = true
    try {
      const ok = await serialQueue.add(() => config_store.saveParam(name, val))
      if (!ok) showWriteError()
    } finally {
      busy = false
    }
  }

  // ── Default state ─────────────────────────────────────────────────────────
  const saveDefaultState   = (active) => saveConfigParam('default_state', active)
  const saveDefaultCurrent = (amps)   => saveConfigParam('max_current_soft', amps)

  // ── Safety toggles (Default State card) ───────────────────────────────────
  const saveBootLock = (enabled) => saveConfigParam('boot_lock', enabled)
  const saveHeartbeatInterval = (sec) => saveConfigParam('heartbeat_interval', sec)
  const saveHeartbeatCurrent  = (amps) => saveConfigParam('heartbeat_current', amps)

  async function saveHeartbeat(enabled) {
    if (busy) return
    busy = true
    try {
      // Enable: restore sensible defaults (keep a previously saved fail current).
      // Disable: interval=0 stops $SY pulses, current=0 is fail-safe.
      const fields = enabled
        ? {
            heartbeat_interval: 5,
            heartbeat_current: ($config_store?.heartbeat_current ?? 0) > 0
              ? $config_store.heartbeat_current
              : 6,
          }
        : { heartbeat_interval: 0, heartbeat_current: 0 }
      const ok = await serialQueue.add(() => config_store.upload(fields))
      if (ok) config_store.update((c) => ({ ...c, ...fields }))
      else showWriteError()
    } finally {
      busy = false
    }
  }

  // ── Temperature protection (combined throttle/panic slider) ───────────────
  const saveTempThrottle = (degC) => saveConfigParam('temp_throttle_setpoint', degC)
  const saveTempPanic    = (degC) => saveConfigParam('over_temp_shutdown', degC)

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
        // A feature can't be both Always-On and Scheduled. Delete this rule's
        // timer pair (if it was scheduled) plus any other scheduled rule for the
        // same feature, so making it always-on removes its schedule.
        const featureKey = actionToFeatureKey(rule.action)
        const toDelete = new Set()
        if (wasScheduled) ruleDeleteIds(rule).forEach((id) => toDelete.add(id))
        if (featureKey) {
          for (const r of rules) {
            if (actionToFeatureKey(r.action) === featureKey) {
              ruleDeleteIds(r).forEach((id) => toDelete.add(id))
            }
          }
        }
        if (toDelete.size) {
          for (const id of toDelete) {
            const ok = await serialQueue.add(() => schedule_store.remove(id))
            if (!ok) { showWriteError(); return }
          }
          await serialQueue.add(() => schedule_store.download())
        }
        // Action changed on global card → clear old config
        if (wasGlobal && rule._prevAction && rule._prevAction !== rule.action) {
          const ok = await clearAlwaysOnAction(rule._prevAction)
          if (!ok) { showWriteError(); return }
        }
        const ok = await applyAlwaysOnAction(rule.action, rule)
        if (!ok) showWriteError()

      } else {
        // Switching from global → clear config first
        if (wasGlobal) {
          const ok = await clearAlwaysOnAction(rule._prevAction ?? rule.action)
          if (!ok) { showWriteError(); return }
        } else {
          // Scheduling a feature that is currently Always-On globally → turn the
          // always-on off so it's scheduled, not both (reverse of the above).
          const featureKey = actionToFeatureKey(rule.action)
          if (featureKey && FEATURE_ACTIVE[featureKey]?.()) {
            const ok = await clearAlwaysOnAction(rule.action)
            if (!ok) { showWriteError(); return }
          }
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
    current={defaultCurrent}
    {minCurrent}
    {maxCurrent}
    {busy}
    {heartbeatSupported}
    heartbeatActive={heartbeatEnabled}
    {heartbeatInterval}
    {heartbeatCurrent}
    {bootLockSupported}
    {bootLock}
    onCurrentChange={saveDefaultCurrent}
    onEdit={() => (settingsOpen = true)}
  />

  <GlobalSection
    enabledFeatures={enabledGlobalFeatures}
    {limit}
    {busy}
    {removingKey}
    {tempProtection}
    onedit={openGlobalEdit}
    onremove={removeGlobalFeature}
    onThrottleChange={saveTempThrottle}
    onPanicChange={saveTempPanic}
  />

  <ConditionalSection
    {rules}
    removingId={removingId}
    {activeEventId}
    {busy}
    onedit={openRuleEdit}
    ondelete={deleteRule}
  />

  <!-- Claims manager (mirror of Monitoring → Manager) -->
  <div class="mt-6">
    <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-text-dim">
      {$_('charge_manager.claims_manager')}
    </h2>
    <ManagerTab rows={claims} />
  </div>
</section>

<GlobalFeaturePicker
  open={pickerOpen}
  enabledKeys={enabledGlobalFeatures}
  unavailableKeys={pickerUnavailable}
  onpick={(key) => { openPickerResult(key); pickerOpen = false }}
  onclose={() => (pickerOpen = false)}
/>

<RuleModal
  open={editorOpen}
  rule={editingRule}
  {busy}
  {socAvailable}
  {ocppAvailable}
  {rfidAvailable}
  {minCurrent}
  {maxCurrent}
  {bootLockSupported}
  {bootLock}
  {heartbeatSupported}
  {heartbeatEnabled}
  onBootLockChange={saveBootLock}
  onHeartbeatChange={saveHeartbeat}
  onclose={() => (editorOpen = false)}
  onsave={(rule) => { editorOpen = false; saveCard(rule) }}
/>

<DefaultStateSettingsModal
  open={settingsOpen}
  {busy}
  active={defaultActive}
  {heartbeatSupported}
  {heartbeatEnabled}
  {heartbeatInterval}
  {heartbeatCurrent}
  {maxCurrent}
  {bootLockSupported}
  {bootLock}
  onDefaultStateChange={saveDefaultState}
  onHeartbeatChange={saveHeartbeat}
  onHeartbeatInterval={saveHeartbeatInterval}
  onHeartbeatCurrent={saveHeartbeatCurrent}
  onBootLockChange={saveBootLock}
  onclose={() => (settingsOpen = false)}
/>
