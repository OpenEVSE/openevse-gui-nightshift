<!-- src/routes/settings/Http.svelte -->
<script>
  import { _, locales } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { certificate_store } from '../../lib/stores/certificates.js'
  import { uisettings_store } from '../../lib/stores/uisettings.js'
  import { LOCALE_NAMES } from '../../lib/i18n/locales.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import CredentialFields from '../../lib/components/config/CredentialFields.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import SegmentedControl from '../../lib/components/ui/SegmentedControl.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  // Auth has no config flag — the firmware treats it as "on" the moment a
  // password is set (a blank username falls back to a default), so key on the
  // password alone. Keying on both would show the toggle as "off" on a
  // password-only device that is actually protected.
  let authOn = $state(false)
  $effect(() => {
    authOn = !!$config_store?.www_password
  })

  function toggleAuth(next) {
    authOn = next
    // Turning auth off clears both credentials; turning it on only reveals
    // the fields — the user then fills and saves them per-field.
    if (!next) form.saveFields({ www_username: '', www_password: '' })
  }

  // Only a certificate that came with a private key can terminate TLS; the
  // firmware refuses to start the HTTPS listener without one and silently falls
  // back to HTTP, so do not offer root certificates here.
  let certOptions = $derived([
    { value: '', label: $_('config.http.https_cert_none') },
    ...(Array.isArray($certificate_store) ? $certificate_store : [])
      .filter((c) => c.type === 'client')
      .map((c) => ({ value: c.id, label: c.name || c.id })),
  ])

  let httpsOn = $derived(!!$config_store?.www_https_enabled)
  let httpOn = $derived($config_store?.www_http_enabled !== false)
  let certId = $derived($config_store?.www_certificate_id ?? '')

  // "Usable" means the stored id still resolves to one of the offered
  // certificates — web_server_setup() needs getCertificate() *and* getKey() to
  // return non-NULL before it starts the listener. An id left behind by a
  // deleted certificate, or pointing at a root certificate with no private
  // key, shows as "None" in the Select while the config still holds it, so
  // testing for an empty string would miss exactly the case the warning is for
  // and the charger would quietly serve plain HTTP.
  let certUsable = $derived(certId !== '' && certOptions.some((o) => o.value === certId))

  // The listener only comes up with both the flag and a usable certificate, and
  // a half-configured HTTPS silently serves plain HTTP instead. Say so rather
  // than letting the user believe they have TLS.
  let httpsIncomplete = $derived(httpsOn && !certUsable)

  // should_start_http = config_http_enabled() || false == use_ssl — the
  // firmware keeps port 80 open whenever TLS is not actually serving, whatever
  // this flag says. Show that rather than an "off" the charger is ignoring.
  let httpForced = $derived(!(httpsOn && certUsable))

  // Nothing in this section takes effect until the gateway reboots:
  // web_server_setup() reads the flags, the certificate and the ports once at
  // boot, and config_changed() has no branch that re-opens a listener (it only
  // rotates the auth secret for www_username / www_password). Track a save so
  // the section can say so instead of leaving the user to discover it.
  let restartPending = $state(false)

  async function saveServerField(name, value) {
    if (await form.saveField(name, value)) restartPending = true
  }

  let langOptions = $derived(
    ($locales ?? ['en']).map((l) => ({ value: l, label: LOCALE_NAMES[l] ?? l })),
  )

  let tempUnitOptions = $derived([
    { value: 'c', label: $_('config.http.temp_celsius') },
    { value: 'f', label: $_('config.http.temp_fahrenheit') },
  ])

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
  <ConfigSection title={$_('config.http.auth')}>
    <FormField label={$_('config.http.auth')}>
      <Toggle checked={authOn} label={$_('config.http.auth')} onchange={toggleAuth} />
    </FormField>
    {#if authOn}
      <!-- Username + password written together in one request (see
           CredentialFields) — a per-field save would 401 the second write the
           moment the password turns auth on with no active session. -->
      <CredentialFields />
    {/if}
  </ConfigSection>

  <ConfigSection title={$_('config.http.server')}>
    <FormField
      label={$_('config.http.https_enabled')}
      description={$_('config.http.https_enabled_desc')}
      status={$ss.www_https_enabled ?? 'idle'}
    >
      <Toggle
        checked={httpsOn}
        label={$_('config.http.https_enabled')}
        onchange={(v) => saveServerField('www_https_enabled', v)}
      />
    </FormField>
    {#if httpsOn}
      <FormField
        label={$_('config.http.https_cert')}
        description={$_('config.http.https_cert_desc')}
        status={$ss.www_certificate_id ?? 'idle'}
      >
        <Select
          options={certOptions}
          value={certId}
          onchange={(v) => saveServerField('www_certificate_id', v)}
        />
      </FormField>
      <FormField label={$_('config.http.https_port')} status={$ss.www_https_port ?? 'idle'}>
        <NumberInput
          value={$config_store?.www_https_port ?? 443}
          min={1}
          max={65535}
          step={1}
          onchange={(v) => saveServerField('www_https_port', v)}
        />
      </FormField>
      {#if httpsIncomplete}
        <p class="py-1 text-sm text-warning">{$_('config.http.https_no_cert')}</p>
      {/if}
    {/if}
    <!-- Turning HTTP off only takes effect once HTTPS is actually serving: the
         firmware keeps port 80 open otherwise so the UI is never stranded, and
         redirects it to HTTPS once there is somewhere to redirect to. Until
         then the control is shown on and disabled — an "off" that the charger
         ignores is worse than no control at all. -->
    <FormField
      label={$_('config.http.http_enabled')}
      description={$_('config.http.http_enabled_desc')}
      status={$ss.www_http_enabled ?? 'idle'}
    >
      <Toggle
        checked={httpOn || httpForced}
        disabled={httpForced}
        label={$_('config.http.http_enabled')}
        onchange={(v) => saveServerField('www_http_enabled', v)}
      />
    </FormField>
    <!-- Everything above is read once at boot, so say what happens next. The
         line upgrades to a prompt with a way through once something is saved. -->
    {#if restartPending}
      <p class="py-1 text-sm text-warning">
        {$_('config.http.server_restart_now')}
        <a class="underline hover:text-text" href="#/settings/firmware">
          {$_('config.firmware.restart_gateway')}
        </a>
      </p>
    {:else}
      <p class="py-1 text-xs text-text-dim">{$_('config.http.server_restart')}</p>
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
    <!-- Device-wide setting: the on-device display reads the same temp_unit. -->
    <FormField label={$_('config.http.temp_unit')} status={$ss.temp_unit ?? 'idle'}>
      <SegmentedControl
        options={tempUnitOptions}
        value={$config_store?.temp_unit ?? 'c'}
        onchange={(v) => form.saveField('temp_unit', v)}
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
