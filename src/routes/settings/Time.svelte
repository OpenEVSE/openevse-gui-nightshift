<!-- src/routes/settings/Time.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import { serialQueue } from '../../lib/queue.js'
  import { showWriteError } from '../../lib/alerts.js'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import { createTzObj } from '../../lib/utils.js'
  import zones from '../../lib/config/zones.json'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import Button from '../../lib/components/ui/Button.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  const tzOptions = createTzObj(zones).map((z) => ({ value: z.value, label: z.name }))
  const sourceOptions = [
    { value: 'manual', label: $_('config.time.manual') },
    { value: 'ntp', label: $_('config.time.ntp') },
  ]

  let isNtp = $derived(!!$config_store?.sntp_enabled)
  let busy = $state(false)

  async function setClockNow() {
    if (busy) return
    busy = true
    try {
      const body = JSON.stringify({
        sntp_enabled: false,
        time: new Date().toISOString(),
        time_zone: $config_store?.time_zone,
      })
      const res = await serialQueue.add(() => httpAPI('POST', '/time', body))
      if (!res || res === 'error' || res.msg !== 'done') showWriteError()
    } finally {
      busy = false
    }
  }
</script>

<ConfigPage title={$_('config.pages.time')}>
  <ConfigSection title={$_('config.time.status')}>
    <ReadOnlyRow label={$_('config.time.device_time')} value={$status_store?.time} />
  </ConfigSection>

  <ConfigSection>
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
    {:else}
      <FormField label={$_('config.time.set_clock')} description={$_('config.time.set_clock_desc')}>
        <Button label={$_('config.time.set_now')} variant="ghost" disabled={busy} onclick={setClockNow} />
      </FormField>
    {/if}

    <FormField label={$_('config.time.timezone')} status={$ss.time_zone ?? 'idle'}>
      <Select
        options={tzOptions}
        value={$config_store?.time_zone ?? ''}
        onchange={(v) => form.saveField('time_zone', v)}
      />
    </FormField>
  </ConfigSection>
</ConfigPage>
