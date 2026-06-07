<!-- src/routes/settings/Vehicle.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import { serialQueue } from '../../lib/queue.js'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import { showWriteError } from '../../lib/alerts.js'
  import { hasTeslaCredentials } from '../../lib/config/tesla.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import PasswordInput from '../../lib/components/ui/PasswordInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import Button from '../../lib/components/ui/Button.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let src = $derived(Number($config_store?.vehicle_data_src ?? 0))

  let srcOptions = $derived([
    { value: '0', label: $_('config.vehicle.src_none') },
    { value: '1', label: $_('config.vehicle.src_tesla') },
    { value: '2', label: $_('config.vehicle.src_mqtt') },
    { value: '3', label: $_('config.vehicle.src_http') },
  ])
  let unitOptions = $derived([
    { value: 'false', label: $_('config.vehicle.km') },
    { value: 'true', label: $_('config.vehicle.miles') },
  ])

  const TESLA_LOGIN_URL = 'https://auth.openevse.com/login'

  let loggedIn = $derived(hasTeslaCredentials($config_store))

  // login form (Tesla account credentials — not stored anywhere)
  let teslaUser = $state('')
  let teslaPass = $state('')
  let loggingIn = $state(false)
  let loginFailed = $state(false)
  let advancedOpen = $state(false)

  // vehicle list
  let vehicles = $state([])
  let vehiclesError = $state(false)

  let vehiclesLoaded = $state(false)
  $effect(() => {
    if (src === 1 && loggedIn && !vehiclesLoaded) {
      vehiclesLoaded = true
      loadVehicles()
    }
    if (!loggedIn) vehiclesLoaded = false
  })

  async function loadVehicles() {
    vehiclesError = false
    const res = await serialQueue.add(() => httpAPI('GET', '/tesla/vehicles'))
    if (!res || res === 'error' || !Array.isArray(res.vehicles)) {
      vehiclesError = true
      vehicles = []
      return
    }
    vehicles = res.vehicles
  }

  async function teslaLogin() {
    if (loggingIn || !teslaUser || !teslaPass) return
    loggingIn = true
    loginFailed = false
    const res = await serialQueue.add(() =>
      httpAPI('POST', TESLA_LOGIN_URL, JSON.stringify({ username: teslaUser, password: teslaPass })),
    )
    loggingIn = false
    if (res && res !== 'error' && res.ok) {
      teslaUser = ''
      teslaPass = ''
      const ok = await form.saveFields({
        tesla_enabled: true,
        tesla_access_token: res.access_token,
        tesla_refresh_token: res.refresh_token,
        tesla_created_at: res.created_at,
        tesla_expires_in: res.expires_in,
      })
      if (!ok) showWriteError()
    } else {
      loginFailed = true
    }
  }

  function teslaLogout() {
    vehicles = []
    return form.saveFields({
      tesla_enabled: false,
      tesla_access_token: '',
      tesla_refresh_token: '',
      tesla_created_at: '',
      tesla_expires_in: '',
    })
  }

  let vehicleOptions = $derived(vehicles.map((v) => ({ value: String(v.id), label: v.name })))
</script>

<ConfigPage title={$_('config.pages.vehicle')}>
  <ConfigSection>
    <FormField label={$_('config.vehicle.source')} status={$ss.vehicle_data_src ?? 'idle'}>
      <Select
        options={srcOptions}
        value={String(src)}
        onchange={(v) => form.saveField('vehicle_data_src', Number(v))}
      />
    </FormField>
  </ConfigSection>

  {#if src === 1}
    <ConfigSection title={$_('config.vehicle.src_tesla')}>
      <FormField label={$_('config.vehicle.range_unit')} status={$ss.mqtt_vehicle_range_miles ?? 'idle'}>
        <Select
          options={unitOptions}
          value={String(!!$config_store?.mqtt_vehicle_range_miles)}
          onchange={(v) => form.saveField('mqtt_vehicle_range_miles', v === 'true')}
        />
      </FormField>

      {#if loggedIn}
        <FormField label={$_('config.vehicle.select_vehicle')} status={$ss.tesla_vehicle_id ?? 'idle'}>
          {#if vehiclesError}
            <p class="text-sm text-error">{$_('config.vehicle.no_vehicles')}</p>
          {:else if vehicleOptions.length > 0}
            <Select
              options={vehicleOptions}
              value={String($config_store?.tesla_vehicle_id ?? '')}
              onchange={(v) => form.saveField('tesla_vehicle_id', v)}
            />
          {:else}
            <p class="text-sm text-text-dim">{$_('config.vehicle.fetching_vehicles')}</p>
          {/if}
        </FormField>
        <div class="py-2">
          <Button label={$_('config.vehicle.logout')} variant="ghost" onclick={teslaLogout} />
        </div>
      {:else}
        <p class="mb-2 text-xs text-text-dim">{$_('config.vehicle.via_openevse')}</p>
        <FormField label={$_('config.vehicle.username')}>
          <input
            type="text"
            aria-label={$_('config.vehicle.username')}
            value={teslaUser}
            oninput={(e) => (teslaUser = e.currentTarget.value)}
            class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm
                   text-text focus:border-accent focus:outline-none"
          />
        </FormField>
        <FormField label={$_('config.vehicle.password')}>
          <input
            type="password"
            aria-label={$_('config.vehicle.password')}
            value={teslaPass}
            oninput={(e) => (teslaPass = e.currentTarget.value)}
            class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm
                   text-text focus:border-accent focus:outline-none"
          />
        </FormField>
        {#if loginFailed}
          <p class="text-sm text-error">{$_('config.vehicle.login_failed')}</p>
        {/if}
        <div class="py-2">
          <Button
            label={loggingIn ? $_('config.vehicle.logging_in') : $_('config.vehicle.login')}
            disabled={loggingIn || !teslaUser || !teslaPass}
            onclick={teslaLogin}
          />
        </div>

        <button
          type="button"
          onclick={() => (advancedOpen = !advancedOpen)}
          class="mt-1 text-xs text-text-dim hover:text-text"
        >
          {$_('config.vehicle.advanced')}
        </button>
        {#if advancedOpen}
          <FormField label={$_('config.vehicle.access_token')} status={$ss.tesla_access_token ?? 'idle'}>
            <PasswordInput
              value={$config_store?.tesla_access_token ?? ''}
              revert={form.revert}
              onchange={(v) => form.saveField('tesla_access_token', v)}
            />
          </FormField>
          <FormField label={$_('config.vehicle.refresh_token')} status={$ss.tesla_refresh_token ?? 'idle'}>
            <PasswordInput
              value={$config_store?.tesla_refresh_token ?? ''}
              revert={form.revert}
              onchange={(v) => form.saveField('tesla_refresh_token', v)}
            />
          </FormField>
        {/if}
      {/if}
    </ConfigSection>
  {:else if src === 2}
    <ConfigSection title={$_('config.vehicle.src_mqtt')}>
      <FormField label={$_('config.vehicle.range_unit')} status={$ss.mqtt_vehicle_range_miles ?? 'idle'}>
        <Select
          options={unitOptions}
          value={String(!!$config_store?.mqtt_vehicle_range_miles)}
          onchange={(v) => form.saveField('mqtt_vehicle_range_miles', v === 'true')}
        />
      </FormField>
      <FormField label={$_('config.vehicle.topic_soc')} status={$ss.mqtt_vehicle_soc ?? 'idle'}>
        <TextInput
          value={$config_store?.mqtt_vehicle_soc ?? ''}
          placeholder="topic/soc"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_vehicle_soc', v)}
        />
      </FormField>
      <FormField label={$_('config.vehicle.topic_range')} status={$ss.mqtt_vehicle_range ?? 'idle'}>
        <TextInput
          value={$config_store?.mqtt_vehicle_range ?? ''}
          placeholder="topic/range"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_vehicle_range', v)}
        />
      </FormField>
      <FormField label={$_('config.vehicle.topic_eta')} status={$ss.mqtt_vehicle_eta ?? 'idle'}>
        <TextInput
          value={$config_store?.mqtt_vehicle_eta ?? ''}
          placeholder="topic/timeleft"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_vehicle_eta', v)}
        />
      </FormField>
    </ConfigSection>
  {:else if src === 3}
    <ConfigSection title={$_('config.vehicle.src_http')}>
      <p class="text-sm text-text-dim">{$_('config.vehicle.http_info')}</p>
      <pre class="mt-2 rounded-xl bg-surface-2 p-3 text-xs text-text-dim">POST http://&lt;charger-ip&gt;/status
&#123; "battery_level": int, "battery_range": int, "time_to_full_charge": int &#125;</pre>
    </ConfigSection>
  {/if}
</ConfigPage>
