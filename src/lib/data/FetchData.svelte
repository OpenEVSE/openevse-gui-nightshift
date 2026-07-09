<script>
  import { onMount } from 'svelte'
  import { status_store } from '../stores/status.js'
  import { schedule_store } from '../stores/schedule.js'
  import { plan_store } from '../stores/plan.js'
  import { config_store } from '../stores/config.js'
  import { override_store } from '../stores/override.js'
  import { claims_target_store } from '../stores/claims_target.js'
  import { claims_store } from '../stores/claims.js'
  import { certificate_store } from '../stores/certificates.js'
  import { uistates_store } from '../stores/uistates.js'

  let { onProgress = () => {}, onStatus = () => {}, onLoaded = () => {}, onError = () => {} } = $props()

  const steps = [
    { store: status_store, progress: 20 },
    { store: schedule_store, progress: 30, after: () => ($uistates_store.schedule_version = $status_store.schedule_version) },
    { store: plan_store, progress: 40, after: () => ($uistates_store.schedule_plan_version = $status_store.schedule_plan_version) },
    { store: config_store, progress: 60, after: () => ($uistates_store.config_version = $status_store.config_version) },
    { store: override_store, progress: 80, after: () => ($uistates_store.override_version = $status_store.override_version) },
    { store: claims_target_store, progress: 90, after: () => ($uistates_store.claims_version = $status_store.claims_version) },
    { store: claims_store, progress: 95 },
    { store: certificate_store, progress: 100 },
  ]

  async function loadData() {
    for (const step of steps) {
      onStatus('loading')
      const ok = await step.store.download()
      if (!ok) {
        onStatus('error')
        onError()
        return
      }
      step.after?.()
      onProgress(step.progress)
    }
    onStatus('ok')
    onLoaded()
  }

  onMount(loadData)
</script>
