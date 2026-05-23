<!--
  src/lib/components/wizard/steps/TimeStep.svelte

  Step 3: minimal time setup — timezone + source. The "Set clock now"
  affordance is intentionally omitted from the wizard since most
  first-run users will be on NTP; manual clock-set still exists on the
  full Settings → Time page.
-->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../../stores/config.js'
  import { createConfigForm } from '../../../config/configForm.svelte.js'
  import { createTzObj } from '../../../utils.js'
  import zones from '../../../config/zones.json'
  import FormField from '../../config/FormField.svelte'
  import Select from '../../ui/Select.svelte'
  import TextInput from '../../ui/TextInput.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  const tzOptions = createTzObj(zones).map((z) => ({ value: z.value, label: z.name }))
  const sourceOptions = $derived([
    { value: 'manual', label: $_('config.time.manual') },
    { value: 'ntp', label: $_('config.time.ntp') },
  ])

  let isNtp = $derived(!!$config_store?.sntp_enabled)
</script>

<div class="space-y-4">
  <p class="text-sm text-text-dim">{$_('wizard.time.intro')}</p>

  <FormField label={$_('config.time.timezone')} status={$ss.time_zone ?? 'idle'}>
    <Select
      options={tzOptions}
      value={$config_store?.time_zone ?? ''}
      onchange={(v) => form.saveField('time_zone', v)}
    />
  </FormField>

  <FormField label={$_('config.time.source')} status={$ss.sntp_enabled ?? 'idle'}>
    <Select
      options={sourceOptions}
      value={isNtp ? 'ntp' : 'manual'}
      onchange={(v) => form.saveField('sntp_enabled', v === 'ntp')}
    />
  </FormField>

  {#if isNtp}
    <FormField label={$_('config.time.ntp_host')} status={$ss.sntp_hostname ?? 'idle'}>
      <TextInput
        value={$config_store?.sntp_hostname ?? ''}
        placeholder="pool.ntp.org"
        revert={form.revert}
        onchange={(v) => form.saveField('sntp_hostname', v)}
      />
    </FormField>
  {/if}
</div>
