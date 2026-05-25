<!-- src/routes/settings/Safety.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'
  import Slider from '../../lib/components/ui/Slider.svelte'

  const form = createConfigForm()

  const CHECKS = [
    'gfci_check', 'ground_check', 'relay_check',
    'temp_check', 'diode_check', 'vent_check',
  ]

  let allOn = $derived(CHECKS.every((c) => !!$config_store?.[c]))
</script>

<ConfigPage title={$_('config.pages.safety')}>
  {#if !allOn}
    <div class="mb-4 rounded-xl border border-warning/40 bg-surface-2 p-3 text-sm text-warning">
      {$_('config.safety.warning')}
    </div>
  {/if}

  <ConfigSection title={$_('config.safety.checks')}>
    {#each CHECKS as check}
      <FormField label={$_('config.safety.' + check)}>
        <Toggle
          checked={!!$config_store?.[check]}
          label={$_('config.safety.' + check)}
          onchange={(v) => form.saveField(check, v)}
        />
      </FormField>
    {/each}
  </ConfigSection>

  <ConfigSection title={$_('config.safety.faults')}>
    <ReadOnlyRow
      label={$_('config.safety.gfci_count')}
      value={$status_store?.gfcicount}
      tone={$status_store?.gfcicount ? 'warn' : 'default'}
    />
    <ReadOnlyRow
      label={$_('config.safety.noground_count')}
      value={$status_store?.nogndcount}
      tone={$status_store?.nogndcount ? 'warn' : 'default'}
    />
    <ReadOnlyRow
      label={$_('config.safety.stuck_count')}
      value={$status_store?.stuckcount}
      tone={$status_store?.stuckcount ? 'warn' : 'default'}
    />
  </ConfigSection>

  <ConfigSection title={$_('config.safety.temp_throttle')}>
    <FormField label={$_('config.safety.temp_throttle_enable')} description={$_('config.safety.temp_throttle_desc')}>
      <Toggle
        checked={!!$config_store?.temp_throttle_enabled}
        label={$_('config.safety.temp_throttle_enable')}
        onchange={(v) => form.saveField('temp_throttle_enabled', v)}
      />
    </FormField>
    {#if $config_store?.temp_throttle_enabled}
      <FormField label={$_('config.safety.temp_throttle_setpoint')}>
        <div class="flex items-center gap-3">
          <Slider
            min={40}
            max={80}
            step={1}
            value={$config_store?.temp_throttle_setpoint ?? 65}
            onchange={(v) => form.saveField('temp_throttle_setpoint', v)}
          />
          <span class="w-12 text-right text-sm tabular-nums text-text">
            {$config_store?.temp_throttle_setpoint ?? 65}°C
          </span>
        </div>
      </FormField>
    {/if}
  </ConfigSection>
</ConfigPage>
