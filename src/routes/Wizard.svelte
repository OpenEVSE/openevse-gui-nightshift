<!--
  src/routes/Wizard.svelte

  First-run setup wizard. App.svelte renders this in place of AppShell
  when config.wizard_passed is false, so the user can't reach the rest
  of the UI until they've at least walked through the steps once.

  Remote-display builds (see lib/config/remoteDisplay.js) get a different
  step list: no charger is attached, so the EVSE page is dropped and two
  device pages (station address + LCD) are added. They also never leave
  the wizard — it IS the whole UI for that build — so there is no Finish.

  Step state is local — we don't use URL params because the app's hash
  router only does exact-match lookups (see lib/router.js).
-->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../lib/stores/config.js'
  import { status_store } from '../lib/stores/status.js'
  import { serialQueue } from '../lib/queue.js'
  import { navigate } from '../lib/router.js'
  import { isRemoteDisplay } from '../lib/config/remoteDisplay.js'
  import WizardShell from '../lib/components/wizard/WizardShell.svelte'
  import FinishDialog from '../lib/components/wizard/FinishDialog.svelte'
  import Welcome from '../lib/components/wizard/steps/Welcome.svelte'
  import EvseBasics from '../lib/components/wizard/steps/EvseBasics.svelte'
  import Wifi from '../lib/components/wizard/steps/Wifi.svelte'
  import TimeStep from '../lib/components/wizard/steps/TimeStep.svelte'
  import RemoteDisplayStep from '../lib/components/wizard/steps/RemoteDisplayStep.svelte'
  import LcdStep from '../lib/components/wizard/steps/LcdStep.svelte'
  import FirmwareInfo from '../lib/components/wizard/steps/FirmwareInfo.svelte'

  let remote = $derived(isRemoteDisplay($config_store))
  let steps = $derived(
    remote
      ? ['welcome', 'wifi', 'time', 'remote', 'lcd', 'firmware']
      : ['welcome', 'evse', 'wifi', 'time', 'firmware'],
  )
  let total = $derived(steps.length)

  let step = $state(0)
  let finishing = $state(false)
  let finishDialog = $state(false)

  let stepName = $derived(steps[Math.min(step, total - 1)])
  let titleKey = $derived(`wizard.${stepName}.title`)

  // The EVSE step configures the controller (max current, phase, default
  // state). If the WiFi module can't reach it over serial the device reports
  // evse_connected: 0, and those reads/writes are meaningless — so hold the
  // wizard on this step until comms are restored (gui-nightshift#17).
  let evseConnected = $derived($status_store?.evse_connected ?? true)
  let commsBlocked = $derived(stepName === 'evse' && !evseConnected)

  // Escape hatch: a charger may be genuinely absent (bench-flashing a module,
  // a dead serial link the user will fix later) yet the person still needs to
  // finish WiFi/time setup. Rather than trap them, we let a deliberate triple
  // tap on Next break through — obvious enough to find on purpose, deliberate
  // enough not to skip setup by accident. The hint appears after the first tap.
  const BYPASS_TAPS = 3
  let bypassTaps = $state(0)
  let bypassRemaining = $derived(
    commsBlocked && bypassTaps > 0 ? BYPASS_TAPS - bypassTaps : 0,
  )

  function goPrev() {
    bypassTaps = 0
    if (step > 0) step -= 1
  }
  function goNext() {
    if (finishing) return
    if (commsBlocked && ++bypassTaps < BYPASS_TAPS) return
    if (step < total - 1) step += 1
    bypassTaps = 0
  }

  // Browser is still on the device AP if it's talking to 192.168.4.1.
  // That means the device is about to reboot into station mode and the
  // browser will have to physically jump networks to reach it again.
  function isOnDeviceAp() {
    return $status_store?.ipaddress === '192.168.4.1'
  }

  async function finish() {
    if (finishing) return
    finishing = true
    // Mark setup as complete — this gate is what App.svelte watches.
    if (!$config_store?.wizard_passed) {
      await serialQueue.add(() => config_store.saveParam('wizard_passed', true))
    }
    finishing = false
    if (isOnDeviceAp()) {
      // Can't auto-redirect — user has to switch their WiFi first.
      finishDialog = true
    } else {
      // Already on the home network — collapse the wizard. App.svelte
      // switches to AppShell now that wizard_passed is true; force the
      // hash to '/' so the Router lands on the Dashboard even if the
      // user arrived here with a stale or hand-typed hash.
      navigate('/')
    }
  }

  function dismissFinish() {
    finishDialog = false
  }
</script>

<WizardShell
  {step}
  {total}
  title={$_(titleKey)}
  canAdvance={!finishing}
  showFinish={!remote}
  onPrev={goPrev}
  onNext={goNext}
  onFinish={finish}
>
  {#if stepName === 'welcome'}
    <Welcome />
  {:else if stepName === 'evse'}
    <EvseBasics {evseConnected} {bypassRemaining} />
  {:else if stepName === 'wifi'}
    <Wifi />
  {:else if stepName === 'time'}
    <TimeStep />
  {:else if stepName === 'remote'}
    <RemoteDisplayStep />
  {:else if stepName === 'lcd'}
    <LcdStep />
  {:else if stepName === 'firmware'}
    <FirmwareInfo />
  {/if}
</WizardShell>

<FinishDialog
  visible={finishDialog}
  hostname={$config_store?.hostname ?? ''}
  onclose={dismissFinish}
/>
