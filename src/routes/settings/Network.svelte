<!-- src/routes/settings/Network.svelte -->
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
  import PasswordInput from '../../lib/components/ui/PasswordInput.svelte'
  import { serialQueue } from '../../lib/queue.js'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import { showWriteError } from '../../lib/alerts.js'
  import { normalizeNetworks, signalIcon, signalPercent, isSecured } from '../../lib/config/wifi.js'
  import Icon from '../../lib/icons/Icon.svelte'
  import Button from '../../lib/components/ui/Button.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let connected = $derived(
    !!($status_store?.wifi_client_connected || $status_store?.eth_connected === 1),
  )

  // "72%" with "(-67 dBm)" as a dim suffix — falls back to the raw value if
  // it isn't a finite number.
  let signalPct = $derived(signalPercent($status_store?.srssi))
  let signal = $derived(signalPct === null ? $status_store?.srssi : `${signalPct}%`)
  let signalDetail = $derived(
    signalPct === null ? '' : `(${$status_store?.srssi} ${$_('units.dbm')})`,
  )

  // ── WiFi scan / join ────────────────────────────────────────────────────
  let networks = $state([])
  let scanning = $state(false)
  let scanError = $state(false)
  let selected = $state(null) // the picked network object
  let wifiPass = $state('')
  let manual = $state(false)
  let manualSsid = $state('')
  let joining = $state(false)
  let joined = $state(false)

  async function scanWifi() {
    if (scanning) return
    scanning = true
    scanError = false
    networks = []
    selected = null
    const res = await serialQueue.add(() => httpAPI('GET', '/scan'))
    scanning = false
    if (!res || res === 'error' || !Array.isArray(res)) {
      scanError = true
      return
    }
    networks = normalizeNetworks(res)
  }

  function pickNetwork(n) {
    selected = n
    manual = false
    wifiPass = ''
  }

  function toggleManual() {
    manual = !manual
    selected = null
    wifiPass = ''
  }

  async function joinSsid(ssid) {
    const normalizedSsid = ssid.trim()
    if (joining || !normalizedSsid) return
    joining = true
    const ok = await serialQueue.add(() =>
      config_store.upload({ ssid: normalizedSsid, pass: wifiPass }),
    )
    joining = false
    if (ok) {
      joined = true
      networks = []
      selected = null
    } else {
      showWriteError()
    }
  }

  function joinWifi() {
    if (selected) joinSsid(selected.ssid)
  }

  function joinManualWifi() {
    joinSsid(manualSsid)
  }
</script>

<ConfigPage title={$_('config.pages.network')}>
  <ConfigSection title={$_('config.network.status')}>
    <ReadOnlyRow label={$_('config.network.mode')} value={$status_store?.mode} />
    <ReadOnlyRow label={$_('config.network.ip')} value={$status_store?.ipaddress} />
    {#if $status_store?.macaddress}
      <ReadOnlyRow label={$_('config.network.mac')} value={$status_store.macaddress} />
    {/if}
    <ReadOnlyRow
      label={$_('config.network.connected')}
      value={connected ? $_('config.connected') : $_('config.not_connected')}
      tone={connected ? 'ok' : 'error'}
    />
    {#if $config_store?.ssid}
      <ReadOnlyRow label={$_('config.network.ssid')} value={$config_store.ssid} />
      <ReadOnlyRow label={$_('config.network.signal')} value={signal} detail={signalDetail} />
    {/if}
  </ConfigSection>

  <ConfigSection title={$_('config.network.wifi')}>
    {#if joined}
      <p class="py-2 text-sm text-text-dim">{$_('config.network.connecting')}</p>
    {:else}
      <div class="py-1">
        <Button
          label={scanning ? $_('config.network.scanning') : $_('config.network.scan')}
          variant="ghost"
          disabled={scanning}
          onclick={scanWifi}
        />
      </div>

      {#if scanError}
        <p class="py-2 text-sm text-error">{$_('config.network.scan_error')}</p>
      {:else if networks.length > 0}
        <ul class="divide-y divide-border">
          {#each networks as n (n.ssid)}
            <li>
              <button
                type="button"
                onclick={() => pickNetwork(n)}
                class="flex w-full items-center gap-3 py-2 text-left text-sm
                       {selected?.ssid === n.ssid ? 'text-accent' : 'text-text'}"
              >
                <Icon icon={signalIcon(n.rssi)} size={18} class="text-text-dim" />
                <span class="flex-1">{n.ssid}</span>
                {#if isSecured(n)}
                  <Icon icon="mdi:lock-outline" size={14} class="text-text-dim" />
                {/if}
              </button>

              {#if selected?.ssid === n.ssid}
                <div class="flex items-end gap-2 pb-3 pl-7">
                  {#if isSecured(n)}
                    <input
                      type="password"
                      placeholder={$_('config.network.wifi_password')}
                      aria-label={$_('config.network.wifi_password')}
                      value={wifiPass}
                      oninput={(e) => (wifiPass = e.currentTarget.value)}
                      class="flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2
                             text-sm text-text focus:border-accent focus:outline-none"
                    />
                  {/if}
                  <div class="shrink-0">
                    <Button
                      label={joining ? $_('config.network.connecting_btn') : $_('config.network.connect')}
                      disabled={joining}
                      onclick={joinWifi}
                    />
                  </div>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}

      <div class="mt-3 border-t border-border pt-4">
        <Button
          label={manual ? $_('config.network.cancel_manual') : $_('config.network.manual')}
          variant="ghost"
          disabled={joining}
          onclick={toggleManual}
        />

        {#if manual}
          <div class="mt-3 space-y-3">
            <input
              type="text"
              placeholder={$_('config.network.ssid')}
              aria-label={$_('config.network.ssid')}
              value={manualSsid}
              oninput={(e) => (manualSsid = e.currentTarget.value)}
              class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2
                     text-sm text-text focus:border-accent focus:outline-none"
            />
            <input
              type="password"
              placeholder={$_('config.network.wifi_password')}
              aria-label={$_('config.network.wifi_password')}
              value={wifiPass}
              oninput={(e) => (wifiPass = e.currentTarget.value)}
              class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2
                     text-sm text-text focus:border-accent focus:outline-none"
            />
            <Button
              label={joining ? $_('config.network.connecting_btn') : $_('config.network.connect')}
              disabled={joining || !manualSsid.trim()}
              onclick={joinManualWifi}
            />
          </div>
        {/if}
      </div>
    {/if}
  </ConfigSection>

  <ConfigSection>
    <FormField label={$_('config.network.host')} status={$ss.hostname ?? 'idle'}>
      <TextInput
        value={$config_store?.hostname ?? ''}
        placeholder="openevse"
        revert={form.revert}
        onchange={(v) => form.saveField('hostname', v)}
      />
    </FormField>
  </ConfigSection>

  {#if $config_store?.wizard_passed}
    <ConfigSection title={$_('config.network.ap')}>
      <p class="mb-1 text-xs text-text-dim">{$_('config.network.apdefault')}</p>
      <FormField label={$_('config.network.apssid')} status={$ss.ap_ssid ?? 'idle'}>
        <TextInput
          value={$config_store?.ap_ssid ?? ''}
          placeholder="openevse"
          revert={form.revert}
          onchange={(v) => form.saveField('ap_ssid', v)}
        />
      </FormField>
      <FormField label={$_('config.network.appass')} status={$ss.ap_pass ?? 'idle'}>
        <PasswordInput
          value={$config_store?.ap_pass ?? ''}
          placeholder="openevse"
          revert={form.revert}
          onchange={(v) => form.saveField('ap_pass', v)}
        />
      </FormField>
    </ConfigSection>
  {/if}
</ConfigPage>
