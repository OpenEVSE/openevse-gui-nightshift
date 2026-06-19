<!-- src/routes/settings/Safety.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import { serialQueue } from '../../lib/queue.js'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import { showWriteError } from '../../lib/alerts.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'
  import Slider from '../../lib/components/ui/Slider.svelte'
  import Button from '../../lib/components/ui/Button.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'

  const form = createConfigForm()

  let heartbeatEnabled = $derived(($config_store?.heartbeat_interval ?? 0) > 0)

  function setHeartbeat(enabled) {
    if (enabled) {
      // Restore sensible defaults; keep any previously saved current > 0
      const interval = 5
      const current = ($config_store?.heartbeat_current ?? 0) > 0
        ? $config_store.heartbeat_current
        : 6
      form.saveFields({ heartbeat_interval: interval, heartbeat_current: current })
    } else {
      // Set interval=0 to stop $SY pulses; current=0 for fail-safe
      form.saveFields({ heartbeat_interval: 0, heartbeat_current: 0 })
    }
  }

  const CHECKS = [
    'gfci_check', 'ground_check', 'relay_check',
    'diode_check', 'vent_check',
  ]

  let allOn = $derived(CHECKS.every((c) => !!$config_store?.[c]))
  let resetting = $state(false)
  let resetDone = $state(false)

  async function resetFaultCounters() {
    if (resetting) return
    resetting = true
    resetDone = false
    try {
      // Single-threaded device server — serialize like every other request.
      const res = await serialQueue.add(() => httpAPI('GET', '/r?json=1&rapi=$FC'))
      if (res && res !== 'error' && !res.error) {
        resetDone = true
        await status_store.download()
        setTimeout(() => (resetDone = false), 3000)
      } else {
        showWriteError()
      }
    } finally {
      resetting = false
    }
  }
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
    {#if $config_store?.overcurrent_monitor !== undefined}
      <FormField label={$_('config.safety.overcurrent_monitor')}>
        <Toggle
          checked={!!$config_store?.overcurrent_monitor}
          label={$_('config.safety.overcurrent_monitor')}
          onchange={(v) => form.saveField('overcurrent_monitor', v)}
        />
      </FormField>
    {/if}
    {#if $config_store?.zero_cross !== undefined}
      <FormField
        label={$_('config.safety.zero_cross')}
        description={$_('config.safety.zero_cross_desc')}
      >
        <Toggle
          checked={!!$config_store?.zero_cross}
          label={$_('config.safety.zero_cross')}
          onchange={(v) => form.saveField('zero_cross', v)}
        />
      </FormField>
    {/if}
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
    <div class="mt-3 flex items-center gap-3">
      <Button
        label={resetting
          ? $_('config.safety.resetting')
          : resetDone
            ? $_('config.safety.reset_done')
            : $_('config.safety.reset_faults')}
        variant={resetDone ? 'ghost' : 'default'}
        disabled={resetting}
        onclick={resetFaultCounters}
      />
    </div>
  </ConfigSection>

  <ConfigSection title={$_('config.safety.temperature')}>
    {#if $config_store?.over_temp_shutdown !== undefined}
      <FormField
        label={$_('config.safety.temp_panic')}
        description={$_('config.safety.temp_panic_desc')}
      >
        <div class="flex items-center gap-3">
          <Slider
            min={68}
            max={82}
            step={1}
            value={$config_store?.over_temp_shutdown ?? 72}
            onchange={(v) => form.saveField('over_temp_shutdown', v)}
          />
          <span class="w-12 text-right text-sm tabular-nums text-text">
            {$config_store?.over_temp_shutdown ?? 72}°C
          </span>
        </div>
      </FormField>
    {/if}
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

  <ConfigSection title={$_('config.security.firmware_security')}>
    {#if $config_store?.boot_lock !== undefined}
      <FormField
        label={$_('config.security.boot_lock')}
        description={$_('config.security.boot_lock_desc')}
      >
        <Toggle
          checked={!!$config_store?.boot_lock}
          label={$_('config.security.boot_lock')}
          onchange={(v) => form.saveField('boot_lock', v)}
        />
      </FormField>
    {/if}

    {#if $config_store?.heartbeat_interval !== undefined}
      <FormField
        label={$_('config.security.heartbeat')}
        description={$_('config.security.heartbeat_desc')}
      >
        <Toggle
          checked={heartbeatEnabled}
          label={$_('config.security.heartbeat')}
          onchange={setHeartbeat}
        />
      </FormField>
      {#if heartbeatEnabled}
        <FormField label={$_('config.security.heartbeat_interval')}>
          <NumberInput
            value={$config_store?.heartbeat_interval ?? 5}
            min={1}
            max={60}
            revert={form.revert}
            onchange={(v) => form.saveField('heartbeat_interval', v)}
          />
        </FormField>
        <FormField
          label={$_('config.security.heartbeat_current')}
          description={`${$config_store?.heartbeat_current ?? 6} A`}
        >
          <div class="flex items-center gap-3">
            <Slider
              min={6}
              max={24}
              step={1}
              value={$config_store?.heartbeat_current ?? 6}
              onchange={(v) => form.saveField('heartbeat_current', v)}
            />
            <span class="w-12 text-right text-sm tabular-nums text-text">
              {$config_store?.heartbeat_current ?? 6} A
            </span>
          </div>
        </FormField>
      {/if}
    {/if}
  </ConfigSection>
</ConfigPage>
