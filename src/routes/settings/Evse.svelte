<!-- src/routes/settings/Evse.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import Card from '../../lib/components/ui/Card.svelte'
  import Icon from '../../lib/icons/Icon.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import Slider from '../../lib/components/ui/Slider.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  // Relay Control card is collapsed by default.
  let relaysOpen = $state(false)
  let showRelays = $derived(
    $config_store?.relay_dc1 !== undefined ||
    $config_store?.relay_dc2 !== undefined ||
    $config_store?.relay_ac !== undefined ||
    $config_store?.zero_cross !== undefined,
  )

  let phaseOptions = $derived([
    { value: 'false', label: $_('config.evse.singlephase') },
    { value: 'true', label: $_('config.evse.threephase_yes') },
  ])
  let serviceOptions = $derived([
    { value: '1', label: $_('config.evse.service_l1') },
    { value: '2', label: $_('config.evse.service_l2') },
  ])

</script>

<ConfigPage title={$_('config.pages.evse')}>
  <ConfigSection title={$_('config.evse.current')}>
    <FormField
      label={$_('config.evse.maxcurrent')}
      description={`${$config_store?.max_current_soft ?? ''} A`}
      status={$ss.max_current_soft ?? 'idle'}
    >
      <Slider
        min={$config_store?.min_current_hard ?? 6}
        max={$config_store?.max_current_hard ?? 32}
        value={$config_store?.max_current_soft ?? 6}
        onchange={(v) => form.saveField('max_current_soft', v)}
      />
    </FormField>
    <ReadOnlyRow
      label={$_('config.evse.maxcurrent_hard')}
      value={$config_store?.max_current_hard != null
        ? `${$config_store.max_current_hard} A`
        : ''}
    />
    {#if $config_store?.voltage !== undefined}
      <FormField
        label={$_('config.evse.voltage')}
        description={$_('config.evse.voltage_desc')}
        status={$ss.voltage ?? 'idle'}
      >
        <div class="flex items-center gap-2">
          <NumberInput
            value={$config_store?.voltage ? $config_store.voltage / 100 : 0}
            min={60}
            max={300}
            step={0.01}
            revert={form.revert}
            onchange={(v) => form.saveField('voltage', v ? Math.round(v * 100) : 0)}
          />
          <span class="text-sm text-text-dim">V</span>
        </div>
      </FormField>
    {/if}
  </ConfigSection>

  {#if showRelays}
    <!-- Relay Control — collapsible, collapsed by default -->
    <Card class="mb-4 p-4">
      <button
        type="button"
        onclick={() => (relaysOpen = !relaysOpen)}
        aria-expanded={relaysOpen}
        class="flex w-full items-center justify-between gap-3 text-left"
      >
        <h2 class="text-sm font-semibold text-text-dim">{$_('config.evse.relays')}</h2>
        <Icon
          icon={relaysOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'}
          size={20}
          class="shrink-0 text-text-dim"
        />
      </button>

      {#if relaysOpen}
        <div class="mt-3">
          {#if $config_store?.relay_dc1 !== undefined}
            <FormField label={$_('config.evse.relay_dc1')} status={$ss.relay_dc1 ?? 'idle'}>
              <Toggle
                checked={!!$config_store?.relay_dc1}
                label={$_('config.evse.relay_dc1')}
                onchange={(v) => form.saveField('relay_dc1', v)}
              />
            </FormField>
          {/if}
          {#if $config_store?.relay_dc2 !== undefined}
            <FormField label={$_('config.evse.relay_dc2')} status={$ss.relay_dc2 ?? 'idle'}>
              <Toggle
                checked={!!$config_store?.relay_dc2}
                label={$_('config.evse.relay_dc2')}
                onchange={(v) => form.saveField('relay_dc2', v)}
              />
            </FormField>
          {/if}
          {#if $config_store?.relay_ac !== undefined}
            <FormField label={$_('config.evse.relay_ac')} status={$ss.relay_ac ?? 'idle'}>
              <Toggle
                checked={!!$config_store?.relay_ac}
                label={$_('config.evse.relay_ac')}
                onchange={(v) => form.saveField('relay_ac', v)}
              />
            </FormField>
          {/if}
          {#if $config_store?.zero_cross !== undefined}
            <FormField
              label={$_('config.safety.zero_cross')}
              description={$_('config.safety.zero_cross_desc')}
              status={$ss.zero_cross ?? 'idle'}
            >
              <Toggle
                checked={!!$config_store?.zero_cross}
                label={$_('config.safety.zero_cross')}
                onchange={(v) => form.saveField('zero_cross', v)}
              />
            </FormField>
          {/if}
        </div>
      {/if}
    </Card>
  {/if}

  <ConfigSection title={$_('config.evse.behaviour')}>
    {#if $config_store?.is_threephase !== undefined}
      <FormField label={$_('config.evse.threephase')} status={$ss.is_threephase ?? 'idle'}>
        <Select
          options={phaseOptions}
          value={String(!!$config_store?.is_threephase)}
          onchange={(v) => form.saveField('is_threephase', v === 'true')}
        />
      </FormField>
    {/if}
    <FormField label={$_('config.evse.service')} status={$ss.service ?? 'idle'}>
      <Select
        options={serviceOptions}
        value={String($config_store?.service || 2)}
        onchange={(v) => form.saveField('service', Number(v))}
      />
    </FormField>
    {#if $config_store?.pp_auto !== undefined}
      <FormField
        label={$_('config.evse.pp_auto')}
        description={$_('config.evse.pp_auto_desc')}
        status={$ss.pp_auto ?? 'idle'}
      >
        <Toggle
          checked={!!$config_store?.pp_auto}
          label={$_('config.evse.pp_auto')}
          onchange={(v) => form.saveField('pp_auto', v)}
        />
      </FormField>
    {/if}
    <FormField label={$_('config.evse.pause_mode')}>
      <Toggle
        checked={!!$config_store?.pause_uses_disabled}
        label={$_('config.evse.pause_mode')}
        onchange={(v) => form.saveField('pause_uses_disabled', v)}
      />
    </FormField>
    {#if $config_store?.button_enabled !== undefined}
      <FormField
        label={$_('config.evse.front_button')}
        description={$_('config.evse.front_button_desc')}
        status={$ss.button_enabled ?? 'idle'}
      >
        <Toggle
          checked={!!$config_store?.button_enabled}
          label={$_('config.evse.front_button')}
          onchange={(v) => form.saveField('button_enabled', v)}
        />
      </FormField>
    {/if}
    <FormField
      label={$_('config.evse.start_window')}
      description={$_('config.evse.start_window_desc')}
      status={$ss.scheduler_start_window ?? 'idle'}
    >
      <NumberInput
        value={$config_store?.scheduler_start_window ?? 0}
        min={0}
        max={3600}
        revert={form.revert}
        onchange={(v) => form.saveField('scheduler_start_window', v)}
      />
    </FormField>
    {#if $config_store?.led_brightness !== undefined}
      <FormField
        label={$_('config.evse.led_brightness')}
        description={`${$config_store?.led_brightness ?? ''}`}
        status={$ss.led_brightness ?? 'idle'}
      >
        <Slider
          min={0}
          max={255}
          value={$config_store?.led_brightness ?? 0}
          onchange={(v) => form.saveField('led_brightness', v)}
        />
      </FormField>
    {/if}
  </ConfigSection>

  <ConfigSection title={$_('config.evse.sensor')}>
    <FormField label={$_('config.evse.scale')} status={$ss.scale ?? 'idle'}>
      <NumberInput
        value={$config_store?.scale ?? 0}
        revert={form.revert}
        onchange={(v) => form.saveField('scale', v)}
      />
    </FormField>
    <FormField label={$_('config.evse.offset')} status={$ss.offset ?? 'idle'}>
      <NumberInput
        value={$config_store?.offset ?? 0}
        revert={form.revert}
        onchange={(v) => form.saveField('offset', v)}
      />
    </FormField>
  </ConfigSection>
</ConfigPage>
