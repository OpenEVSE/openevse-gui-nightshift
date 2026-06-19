<script>
  import { onMount } from 'svelte'
  import { status_store } from '../stores/status.js'
  import { schedule_store } from '../stores/schedule.js'
  import { plan_store } from '../stores/plan.js'
  import { config_store } from '../stores/config.js'
  import { override_store } from '../stores/override.js'
  import { claims_target_store } from '../stores/claims_target.js'
  import { certificate_store } from '../stores/certificates.js'
  import { uistates_store } from '../stores/uistates.js'
  import { httpAPI } from '../api/httpAPI.js'
  import { serialQueue } from '../queue.js'

  let { onProgress = () => {}, onStatus = () => {}, onLoaded = () => {}, onError = () => {} } = $props()

  // Mandatory steps (status/schedule/config/override) abort startup on failure.
  // Optional steps (plan/claims/certificates) cover features a reduced-capability
  // device — JuiceBox/lite — does not implement; a 404 there just leaves the
  // store at its empty default and startup proceeds.
  const steps = [
    { store: status_store, progress: 20 },
    { store: schedule_store, progress: 30, after: () => ($uistates_store.schedule_version = $status_store.schedule_version) },
    { store: plan_store, progress: 40, after: () => ($uistates_store.schedule_plan_version = $status_store.schedule_plan_version), optional: true },
    { store: config_store, progress: 60, after: () => ($uistates_store.config_version = $status_store.config_version) },
    { store: override_store, progress: 80, after: () => ($uistates_store.override_version = $status_store.override_version) },
    { store: claims_target_store, progress: 90, after: () => ($uistates_store.claims_version = $status_store.claims_version), optional: true },
    { store: certificate_store, progress: 100, optional: true },
  ]

  async function loadData() {
    for (const step of steps) {
      onStatus('loading')
      const ok = await step.store.download()
      if (!ok && !step.optional) {
        onStatus('error')
        onError()
        return
      }
      if (ok) step.after?.() // only mark the version synced when it actually loaded
      onProgress(step.progress)
    }
    // Non-fatal capability probe: GET /logs returns the log-index range on
    // devices with history logging; a device without it (JuiceBox) errors.
    // Either way startup proceeds — we just hide the History tab when absent.
    const logs = await serialQueue.add(() => httpAPI('GET', '/logs'))
    $uistates_store.history_available = !!logs && logs !== 'error' && logs.msg !== 'error'
    // Non-fatal capability probe: $GV (get version) is a read-only RAPI command.
    // OpenEVSE answers it; a device with no EVSE module / no RAPI passthrough
    // (JuiceBox) errors. Drives the dev console's RAPI branding + "$" default.
    const rapi = await serialQueue.add(() => httpAPI('GET', '/r?json=1&rapi=$GV'))
    $uistates_store.rapi_available = !!rapi && rapi !== 'error' && rapi.ret !== undefined
    onStatus('ok')
    onLoaded()
  }

  onMount(loadData)
</script>
