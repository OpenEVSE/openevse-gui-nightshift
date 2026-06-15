<!--
  src/lib/components/wizard/steps/EvseBasics.svelte

  Step 1: just the EVSE knobs a new user genuinely needs at first
  power-on — max current, three-phase (EU), default state. Everything
  else is reachable from Settings later.
-->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../../stores/config.js'
  import { createConfigForm } from '../../../config/configForm.svelte.js'
  import FormField from '../../config/FormField.svelte'
  import Slider from '../../ui/Slider.svelte'
  import Select from '../../ui/Select.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let liveMaxCurrent = $state(null)
  let shownMaxCurrent = $derived(
    liveMaxCurrent ?? $config_store?.max_current_soft ?? 6,
  )

  async function saveMaxCurrent(value) {
    liveMaxCurrent = value
    await form.saveField('max_current_soft', value)
    liveMaxCurrent = null
  }

  let boolOptions = $derived([
    { value: 'false', label: $_('config.evse.disabled') },
    { value: 'true', label: $_('config.evse.active') },
  ])
  let phaseOptions = $derived([
    { value: 'false', label: $_('config.evse.singlephase') },
    { value: 'true', label: $_('config.evse.threephase_yes') },
  ])
</script>

<div class="space-y-4">
  <p class="text-sm text-text-dim">{$_('wizard.evse.intro')}</p>

  <FormField
    label={$_('config.evse.maxcurrent')}
    description={`${shownMaxCurrent} A`}
    status={$ss.max_current_soft ?? 'idle'}
  >
    <Slider
      min={$config_store?.min_current_hard ?? 6}
      max={$config_store?.max_current_hard ?? 32}
      value={$config_store?.max_current_soft ?? 6}
      oninput={(v) => (liveMaxCurrent = v)}
      onchange={saveMaxCurrent}
    />
  </FormField>

  {#if $config_store?.is_threephase !== undefined}
    <FormField label={$_('config.evse.threephase')} status={$ss.is_threephase ?? 'idle'}>
      <Select
        options={phaseOptions}
        value={String(!!$config_store?.is_threephase)}
        onchange={(v) => form.saveField('is_threephase', v === 'true')}
      />
    </FormField>
  {/if}

  {#if $config_store?.default_state !== undefined}
    <FormField label={$_('config.evse.defaultstate')} status={$ss.default_state ?? 'idle'}>
      <Select
        options={boolOptions}
        value={String(!!$config_store?.default_state)}
        onchange={(v) => form.saveField('default_state', v === 'true')}
      />
    </FormField>
  {/if}
</div>
