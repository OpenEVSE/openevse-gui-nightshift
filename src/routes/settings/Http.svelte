<!-- src/routes/settings/Http.svelte -->
<script>
  import { _, locales } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { uisettings_store } from '../../lib/stores/uisettings.js'
  import { certificate_store } from '../../lib/stores/certificates.js'
  import { serialQueue } from '../../lib/queue.js'
  import { showWriteError } from '../../lib/alerts.js'
  import { LOCALE_NAMES } from '../../lib/i18n/locales.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import PasswordInput from '../../lib/components/ui/PasswordInput.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import SegmentedControl from '../../lib/components/ui/SegmentedControl.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'
  import Button from '../../lib/components/ui/Button.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let generating = $state(false)

  let certificates = $derived(Array.isArray($certificate_store) ? $certificate_store : [])

  // Only certs with a private key (type "client") can terminate inbound
  // HTTPS — a "root" entry is CA-only, no key, can't serve as the listener's
  // own cert.
  let httpsCertOptions = $derived([
    { value: '', label: $_('config.certificates.https_none') },
    ...certificates.filter((c) => c.type === 'client').map((c) => ({ value: c.id, label: c.name || c.id })),
  ])

  async function generateSelfSigned() {
    if (generating) return
    generating = true
    try {
      const res = await serialQueue.add(() => certificate_store.generateSelfSigned())
      if (res && res.success) {
        await serialQueue.add(() => certificate_store.download())
        // Immediately activate the cert we just generated for HTTPS, rather
        // than leaving the user to find and select it by hand.
        await form.saveField('www_certificate_id', res.id)
      } else {
        showWriteError()
      }
    } finally {
      generating = false
    }
  }

  // Auth has no config flag — it is "on" when both credentials are set.
  let authOn = $state(false)
  $effect(() => {
    authOn = !!($config_store?.www_username && $config_store?.www_password)
  })

  function toggleAuth(next) {
    authOn = next
    // Turning auth off clears both credentials; turning it on only reveals
    // the fields — the user then fills and saves them per-field.
    if (!next) form.saveFields({ www_username: '', www_password: '' })
  }

  let langOptions = $derived(
    ($locales ?? ['en']).map((l) => ({ value: l, label: LOCALE_NAMES[l] ?? l })),
  )

  let tempUnitOptions = $derived([
    { value: 'c', label: $_('config.http.temp_celsius') },
    { value: 'f', label: $_('config.http.temp_fahrenheit') },
  ])

  function setTempUnit(unit) {
    uisettings_store.update((s) => ({ ...s, temp_unit: unit }))
  }

  function setEnergyRate(rate) {
    uisettings_store.update((s) => ({ ...s, energy_rate: rate ?? 0 }))
  }

  function setCurrency(symbol) {
    uisettings_store.update((s) => ({ ...s, currency_symbol: symbol || '$' }))
  }

  // Curated list — enough symbols to cover the obvious cases without
  // needing a text input. Picked first because they fit a single glyph
  // in the chip layouts that consume them.
  const currencyOptions = [
    { value: '$', label: '$' },
    { value: '€', label: '€' },
    { value: '£', label: '£' },
    { value: '¥', label: '¥' },
    { value: '₹', label: '₹' },
    { value: 'kr', label: 'kr' },
  ]
</script>

<ConfigPage title={$_('config.pages.http')}>
  <ConfigSection title={$_('config.http.portal')}>
    <FormField label={$_('config.http.enable')}>
      <Toggle
        checked={$config_store?.www_http_enabled ?? true}
        label={$_('config.http.enable')}
        onchange={(v) => form.saveField('www_http_enabled', v)}
      />
    </FormField>
    <FormField label={$_('config.certificates.https_enable')}>
      <Toggle
        checked={$config_store?.www_https_enabled ?? false}
        label={$_('config.certificates.https_enable')}
        onchange={(v) => form.saveField('www_https_enabled', v)}
      />
    </FormField>
    {#if $config_store?.www_https_enabled}
      <FormField
        label={$_('config.certificates.https_cert')}
        description={$_('config.certificates.https_cert_desc')}
        status={$ss.www_certificate_id ?? 'idle'}
      >
        <Select
          options={httpsCertOptions}
          value={$config_store?.www_certificate_id ?? ''}
          onchange={(v) => form.saveField('www_certificate_id', v)}
        />
      </FormField>
      <FormField label={$_('config.certificates.https_port')} status={$ss.www_https_port ?? 'idle'}>
        <NumberInput
          value={$config_store?.www_https_port ?? 443}
          min={1}
          max={65535}
          revert={form.revert}
          onchange={(v) => form.saveField('www_https_port', v)}
        />
      </FormField>
      <div class="pt-1">
        <Button
          label={$_('config.certificates.generate_self_signed')}
          disabled={generating}
          onclick={generateSelfSigned}
        />
      </div>
    {/if}

    <FormField label={$_('config.http.auth')}>
      <Toggle checked={authOn} label={$_('config.http.auth')} onchange={toggleAuth} />
    </FormField>
    {#if authOn}
      <FormField label={$_('config.http.username')} status={$ss.www_username ?? 'idle'}>
        <TextInput
          value={$config_store?.www_username ?? ''}
          maxlength={15}
          revert={form.revert}
          onchange={(v) => form.saveField('www_username', v)}
        />
      </FormField>
      <FormField label={$_('config.http.password')} status={$ss.www_password ?? 'idle'}>
        <PasswordInput
          value={$config_store?.www_password ?? ''}
          maxlength={15}
          revert={form.revert}
          onchange={(v) => form.saveField('www_password', v)}
        />
      </FormField>
    {/if}
  </ConfigSection>

  <ConfigSection title={$_('config.http.ssh')}>
    <FormField label={$_('config.http.ssh_enable')}>
      <Toggle
        checked={$config_store?.ssh_enabled ?? false}
        label={$_('config.http.ssh_enable')}
        onchange={(v) => form.saveField('ssh_enabled', v)}
      />
    </FormField>
    {#if $config_store?.ssh_enabled}
      <FormField label={$_('config.http.ssh_username')} status={$ss.ssh_username ?? 'idle'}>
        <TextInput
          value={$config_store?.ssh_username ?? ''}
          maxlength={32}
          revert={form.revert}
          onchange={(v) => form.saveField('ssh_username', v)}
        />
      </FormField>
      <FormField label={$_('config.http.ssh_password')} status={$ss.ssh_password ?? 'idle'}>
        <PasswordInput
          value={$config_store?.ssh_password ?? ''}
          maxlength={32}
          revert={form.revert}
          onchange={(v) => form.saveField('ssh_password', v)}
        />
      </FormField>
      <!-- v1 limitation: the SSH listener only starts/restarts on boot. -->
      <FormField label={$_('config.http.ssh_note')} description={$_('config.http.ssh_note_desc')} />
    {/if}
  </ConfigSection>

  <ConfigSection>
    <FormField label={$_('config.http.lang')} status={$ss.lang ?? 'idle'}>
      <Select
        options={langOptions}
        value={$config_store?.lang ?? 'en'}
        onchange={(v) => form.saveField('lang', v)}
      />
    </FormField>
    <!-- Local-only preference — not synced to the device. -->
    <FormField label={$_('config.http.temp_unit')}>
      <SegmentedControl
        options={tempUnitOptions}
        value={$uisettings_store?.temp_unit ?? 'c'}
        onchange={setTempUnit}
      />
    </FormField>
    <!-- Local-only tariff — used to show cost on Dashboard + History.
         Rate of 0 hides the cost UI everywhere. -->
    <FormField
      label={$_('config.http.energy_rate')}
      description={$_('config.http.energy_rate_desc')}
    >
      <NumberInput
        value={$uisettings_store?.energy_rate ?? 0}
        min={0}
        step={0.01}
        onchange={setEnergyRate}
      />
    </FormField>
    <FormField label={$_('config.http.currency')}>
      <Select
        options={currencyOptions}
        value={$uisettings_store?.currency_symbol ?? '$'}
        onchange={setCurrency}
      />
    </FormField>
  </ConfigSection>
</ConfigPage>
