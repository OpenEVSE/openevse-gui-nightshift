<!--
  src/routes/Wizard.svelte

  First-run setup wizard. App.svelte renders this in place of AppShell
  when config.wizard_passed is false, so the user can't reach the rest
  of the UI until they've at least walked through the steps once.

  Step state is local — we don't use URL params because the app's hash
  router only does exact-match lookups (see lib/router.js).
-->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../lib/stores/config.js'
  import { status_store } from '../lib/stores/status.js'
  import { serialQueue } from '../lib/queue.js'
  import { navigate } from '../lib/router.js'
  import WizardShell from '../lib/components/wizard/WizardShell.svelte'
  import FinishDialog from '../lib/components/wizard/FinishDialog.svelte'
  import Welcome from '../lib/components/wizard/steps/Welcome.svelte'
  import EvseBasics from '../lib/components/wizard/steps/EvseBasics.svelte'
  import Wifi from '../lib/components/wizard/steps/Wifi.svelte'
  import TimeStep from '../lib/components/wizard/steps/TimeStep.svelte'
  import Security from '../lib/components/wizard/steps/Security.svelte'
  import FirmwareInfo from '../lib/components/wizard/steps/FirmwareInfo.svelte'

  // WiFi is provisioned LAST on purpose: joining the network makes the ESP32's
  // softAP hop to the router's channel, which drops a phone/laptop that set the
  // device up over that AP. Doing every other step first (all reachable on the
  // AP) and connecting WiFi as the final action means the single network hand-
  // off happens once, at the end, where it's expected.
  const STEPS = ['welcome', 'evse', 'time', 'security', 'firmware', 'wifi']
  const TOTAL = STEPS.length

  let step = $state(0)
  let finishDialog = $state(false)

  let titleKey = $derived(`wizard.${STEPS[step]}.title`)

  // The EVSE step configures the controller (max current, phase, default
  // state). If the WiFi module can't reach it over serial the device reports
  // evse_connected: 0, and those reads/writes are meaningless — so hold the
  // wizard on this step until comms are restored (gui-nightshift#17).
  let evseConnected = $derived($status_store?.evse_connected ?? true)
  let commsBlocked = $derived(STEPS[step] === 'evse' && !evseConnected)

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
    if (commsBlocked && ++bypassTaps < BYPASS_TAPS) return
    if (step < TOTAL - 1) step += 1
    bypassTaps = 0
  }

  // Browser is still on the device AP if it's talking to 192.168.4.1.
  // That means the device is about to reboot into station mode and the
  // browser will have to physically jump networks to reach it again.
  function isOnDeviceAp() {
    return $status_store?.ipaddress === '192.168.4.1'
  }

  // Persist the "setup done" flag. Called by the WiFi step BEFORE it joins the
  // network — the join drops the softAP, so wizard_passed must be written while
  // the device is still reachable, or the wizard would reappear next boot.
  async function markComplete() {
    if (!$config_store?.wizard_passed) {
      await serialQueue.add(() => config_store.saveParam('wizard_passed', true))
    }
  }

  // The WiFi step has joined (request sent, AP about to drop). markComplete
  // already wrote wizard_passed before the join. If we're still on the device
  // AP the user must physically switch networks, so show the reconnect address;
  // otherwise we're already on the home network, so collapse straight to the
  // dashboard (App.svelte swaps to AppShell once wizard_passed is true).
  function onWifiJoined() {
    if (isOnDeviceAp()) {
      finishDialog = true
    } else {
      navigate('/')
    }
  }

  function dismissFinish() {
    finishDialog = false
  }
</script>

<WizardShell
  {step}
  total={TOTAL}
  title={$_(titleKey)}
  hideAdvance={STEPS[step] === 'wifi'}
  onPrev={goPrev}
  onNext={goNext}
>
  {#if step === 0}
    <Welcome />
  {:else if step === 1}
    <EvseBasics {evseConnected} {bypassRemaining} />
  {:else if step === 2}
    <TimeStep />
  {:else if step === 3}
    <Security />
  {:else if step === 4}
    <FirmwareInfo />
  {:else if step === 5}
    <Wifi beforeJoin={markComplete} onJoined={onWifiJoined} />
  {/if}
</WizardShell>

<FinishDialog
  visible={finishDialog}
  hostname={$config_store?.hostname ?? ''}
  onclose={dismissFinish}
/>
