<!-- src/lib/components/config/SafetyChecksCard.svelte -->
<script>
  // The collapsible Safety Checks card with its on/off toggles. These switch
  // off protections the installation may legitimately provide another way (the
  // GFCI self-test on a GFCI-protected circuit), so it lives on the
  // installer-gated Installer Tools page, not in everyday Safety settings.
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../stores/config.js'
  import { createConfigForm } from '../../config/configForm.svelte.js'
  import { allRequiredSafetyChecksOn } from '../../config/safety.js'
  import { notification_store } from '../../stores/notifications.js'
  import { settingsMarkers } from '../../notifications/notifications.js'
  import AdvisoryMarker from '../notifications/AdvisoryMarker.svelte'
  import FormField from './FormField.svelte'
  import Card from '../ui/Card.svelte'
  import Icon from '../../icons/Icon.svelte'
  import Toggle from '../ui/Toggle.svelte'

  const form = createConfigForm()

  // Collapsed by default — the at-a-glance status next to the title tells the
  // user whether they need to expand it.
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
        <FormField
          label={$_('config.safety.' + check)}
          description={check === 'gfci_check' ? $_('config.safety.gfci_check_desc') : ''}
        >
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
