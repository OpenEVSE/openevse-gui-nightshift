<!-- src/routes/settings/Shaper.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'

  const form = createConfigForm()
  const ss = form.saveState
</script>

<ConfigPage title={$_('config.pages.shaper')}>
  <!-- Enabling/scheduling Grid shaping is done from the Charge Manager. -->
  <a
    href="#/schedule"
    class="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5
           text-sm font-semibold text-white transition hover:opacity-90"
  >
    + {$_('config.add_in_charge_manager')}
  </a>

  <ConfigSection>
    <ReadOnlyRow
      label={$_('config.shaper.state')}
      value={$status_store?.shaper_updated ? $_('config.shaper.updated') : $_('config.shaper.stale')}
      tone={$status_store?.shaper_updated ? 'ok' : 'error'}
    />
    <ReadOnlyRow label={$_('config.shaper.live_power')} value={`${$status_store?.shaper_live_pwr ?? 0} W`} />
    <ReadOnlyRow label={$_('config.shaper.available')} value={`${$status_store?.shaper_cur ?? 0} A`} />
  </ConfigSection>

  <ConfigSection title={$_('config.shaper.settings')}>
    <FormField label={$_('config.shaper.max_power')} status={$ss.current_shaper_max_pwr ?? 'idle'}>
      <NumberInput
        value={$config_store?.current_shaper_max_pwr ?? null}
        placeholder="9000"
        revert={form.revert}
        onchange={(v) => form.saveField('current_shaper_max_pwr', v)}
      />
    </FormField>
    <FormField label={$_('config.shaper.live_topic')} status={$ss.mqtt_live_pwr ?? 'idle'}>
      <TextInput
        value={$config_store?.mqtt_live_pwr ?? ''}
        placeholder="topic/powerload"
        revert={form.revert}
        onchange={(v) => form.saveField('mqtt_live_pwr', v)}
      />
    </FormField>
    <FormField label={$_('config.shaper.min_pause')} status={$ss.current_shaper_min_pause_time ?? 'idle'}>
      <NumberInput
        value={$config_store?.current_shaper_min_pause_time ?? null}
        min={0}
        max={60}
        placeholder="5"
        revert={form.revert}
        onchange={(v) => form.saveField('current_shaper_min_pause_time', v)}
      />
    </FormField>
    <FormField
      label={$_('config.shaper.max_interval')}
      description={$_('config.shaper.max_interval_desc')}
      status={$ss.current_shaper_data_maxinterval ?? 'idle'}
    >
      <NumberInput
        value={$config_store?.current_shaper_data_maxinterval ?? null}
        min={10}
        max={300}
        placeholder="120"
        revert={form.revert}
        onchange={(v) => form.saveField('current_shaper_data_maxinterval', v)}
      />
    </FormField>
    <FormField
      label={$_('config.shaper.smoothing')}
      description={$_('config.shaper.smoothing_desc')}
      status={$ss.current_shaper_smoothing_time ?? 'idle'}
    >
      <NumberInput
        value={$config_store?.current_shaper_smoothing_time ?? null}
        min={0}
        max={600}
        revert={form.revert}
        onchange={(v) => form.saveField('current_shaper_smoothing_time', v)}
      />
    </FormField>
  </ConfigSection>
</ConfigPage>
