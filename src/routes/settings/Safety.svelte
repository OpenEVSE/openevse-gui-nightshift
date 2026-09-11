<!-- src/routes/settings/Safety.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import { allRequiredSafetyChecksOn } from '../../lib/config/safety.js'
  import { notification_store } from '../../lib/stores/notifications.js'
  import { settingsMarkers } from '../../lib/notifications/notifications.js'
  import AdvisoryMarker from '../../lib/components/notifications/AdvisoryMarker.svelte'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import Card from '../../lib/components/ui/Card.svelte'
  import Icon from '../../lib/icons/Icon.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'
  import TempProtectionCard from '../../lib/components/charge_manager/TempProtectionCard.svelte'

  const form = createConfigForm()

  // Safety Checks card is collapsed by default — the at-a-glance status next to
  // the title tells the user whether they need to expand it.
  let checksOpen = $state(false)
  let checksToggled = $state(false)

  // All checks rendered as toggles, in display order. `temp_check` is here
  // because the firmware raises safety.temp_check when it is off, and an
  // advisory that says "temperature monitoring is off" is worth nothing
  // without the switch that turns it back on. Presence-gated like
  // overcurrent_monitor below: absent from /config means the charger has no
  // such setting, and an unconditional toggle would read a missing key as
  // "off" and offer to fix something that isn't broken.
  const BASE_CHECKS = [
    'gfci_check', 'ground_check', 'relay_check',
    'diode_check', 'vent_check',
  ]
  let CHECKS = $derived(
    $config_store?.temp_check === undefined ? BASE_CHECKS : [...BASE_CHECKS, 'temp_check'],
  )
  // GFCI self-test and overcurrent monitoring are optional safety features —
  // they're shown but don't gate the "All Required Safety Checks On" status
  // (see lib/config/safety.js, shared with the Charge Manager).
  let allOn = $derived(allRequiredSafetyChecksOn($config_store))

  // Config key → the advisory raised against it, muted entries included:
  // acking silences the alarm, it never hides the state. The count also shows
  // on the closed header, so a muted advisory is never invisible on the one
  // page that can act on it.
  let markers = $derived(settingsMarkers($notification_store.items))
  let markerCount = $derived(CHECKS.filter((c) => markers[c]).length)

  $effect(() => {
    // Open the card the first time the charger reports an advisory about one
    // of these switches. A marker sitting behind a collapsed card is a marker
    // nobody reads, and an advisory is exactly the signal the collapsed
    // default was waiting for. Once only — a deliberate collapse must not be
    // re-opened on the next poll.
    if (!checksToggled && markerCount > 0) checksOpen = true
  })
</script>

<ConfigPage title={$_('config.pages.safety')}>
  <!-- Collapsible Safety Checks card: status shown next to the title -->
  <Card class="mb-4 p-4">
    <button
      type="button"
      onclick={() => { checksToggled = true; checksOpen = !checksOpen }}
      aria-expanded={checksOpen}
      class="flex w-full items-center justify-between gap-3 text-left"
    >
      <h2 class="shrink-0 text-sm font-semibold text-text-dim">{$_('config.safety.checks')}</h2>
      <span class="flex min-w-0 items-center gap-2">
        {#if markerCount > 0}
          <span class="truncate text-xs font-semibold text-warning">
            {$_('notifications.checks_off', { values: { count: markerCount } })}
          </span>
        {:else if allOn}
          <span class="truncate text-xs font-semibold text-success">{$_('config.safety.all_on')}</span>
        {:else}
          <span class="truncate text-xs font-semibold text-warning">{$_('config.safety.warning')}</span>
        {/if}
        <Icon
          icon={checksOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'}
          size={20}
          class="shrink-0 text-text-dim"
        />
      </span>
    </button>

    {#if checksOpen}
      <div class="mt-3">
        {#each CHECKS as check}
          <FormField label={$_('config.safety.' + check)}>
            {#snippet badge()}
              <AdvisoryMarker marker={markers[check] ?? null} />
            {/snippet}
            <Toggle
              checked={!!$config_store?.[check]}
              label={$_('config.safety.' + check)}
              onchange={(v) => form.saveField(check, v)}
            />
          </FormField>
        {/each}
        {#if $config_store?.overcurrent_monitor !== undefined}
          <FormField label={$_('config.safety.overcurrent_monitor')}>
            <Toggle
              checked={!!$config_store?.overcurrent_monitor}
              label={$_('config.safety.overcurrent_monitor')}
              onchange={(v) => form.saveField('overcurrent_monitor', v)}
            />
          </FormField>
        {/if}
      </div>
    {/if}
  </Card>

  <ConfigSection title={$_('config.safety.temp_throttle')}>
    <FormField label={$_('config.safety.temp_throttle_enable')} description={$_('config.safety.temp_throttle_desc')}>
      <Toggle
        checked={!!$config_store?.temp_throttle_enabled}
        label={$_('config.safety.temp_throttle_enable')}
        onchange={(v) => form.saveField('temp_throttle_enabled', v)}
      />
    </FormField>
  </ConfigSection>

  {#if $config_store?.temp_throttle_enabled && $config_store?.over_temp_shutdown !== undefined}
    <TempProtectionCard
      throttle={$config_store?.temp_throttle_setpoint ?? 65}
      panic={$config_store?.over_temp_shutdown ?? 72}
      min={40}
      max={82}
      unit={$config_store?.temp_unit ?? 'c'}
      onThrottleChange={(v) => form.saveField('temp_throttle_setpoint', v)}
      onPanicChange={(v) => form.saveField('over_temp_shutdown', v)}
    />
  {/if}
</ConfigPage>
