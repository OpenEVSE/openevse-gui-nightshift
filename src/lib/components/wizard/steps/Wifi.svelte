<!--
  src/lib/components/wizard/steps/Wifi.svelte

  Step 2: scan / pick / join. Auto-scans on mount the way v2 did, so
  the first-run user lands on a populated list with no extra tap.

  When the device accepts our join request it reboots into station mode
  and the gateway disappears from this AP. We don't try to follow it —
  the finish-step handoff (FinishDialog) prints the new address to
  reconnect to.
-->
<script>
  import { onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../../stores/config.js'
  import { status_store } from '../../../stores/status.js'
  import { serialQueue } from '../../../queue.js'
  import { httpAPI } from '../../../api/httpAPI.js'
  import { showWriteError } from '../../../alerts.js'
  import { normalizeNetworks, signalIcon, isSecured } from '../../../config/wifi.js'
  import Icon from '../../../icons/Icon.svelte'
  import Button from '../../ui/Button.svelte'

  let { onJoined = () => {}, beforeJoin = async () => {} } = $props()

  // Where to reach the charger once it leaves the setup hotspot. The DHCP IP
  // isn't known ahead of time, so we show the mDNS hostname (same as
  // FinishDialog). Empty until the config has loaded a hostname.
  let displayHost = $derived(
    $config_store?.hostname ? `${$config_store.hostname}.local` : '',
  )

  let networks = $state([])
  let scanning = $state(false)
  let scanError = $state(false)
  let selected = $state(null)
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
    // Mark setup complete BEFORE joining: upload() switches the device to
    // station mode and the softAP drops, so a write issued after this may never
    // reach the device. Doing it first means the wizard won't reappear.
    await beforeJoin()
    const ok = await serialQueue.add(() =>
      config_store.upload({ ssid: normalizedSsid, pass: wifiPass }),
    )
    joining = false
    if (ok) {
      joined = true
      networks = []
      onJoined(normalizedSsid)
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

  onMount(scanWifi)
</script>

<div class="space-y-4">
  {#if $status_store?.ssid || $config_store?.ssid}
    <!-- Already on a network: show it as a status row + a "change" path -->
    <div class="rounded-xl border border-border bg-surface-2 p-3 text-sm">
      <p class="text-text-dim">{$_('wizard.wifi.current')}</p>
      <p class="font-semibold text-text">
        {$status_store?.ssid || $config_store?.ssid}
      </p>
    </div>
  {/if}

  {#if joined}
    <div class="rounded-xl border border-border bg-surface-2 p-3 text-sm text-text">
      <p>{$_('wizard.wifi.joined')}</p>
      {#if displayHost}
        <p class="mt-3 text-xs uppercase tracking-wider text-text-dim">
          {$_('wizard.wifi.reach_at')}
        </p>
        <p class="break-all text-sm font-semibold text-accent">http://{displayHost}</p>
      {/if}
    </div>
  {:else}
    <!-- Heads-up before the AP hand-off: connecting ends this setup session. -->
    <div class="rounded-xl border border-border bg-surface-2 p-3 text-sm">
      <p class="font-semibold text-text">{$_('wizard.wifi.handoff_title')}</p>
      <p class="mt-1 text-text-dim">{$_('wizard.wifi.handoff_body')}</p>
      {#if displayHost}
        <p class="mt-2 text-xs uppercase tracking-wider text-text-dim">
          {$_('wizard.wifi.reach_at')}
        </p>
        <p class="break-all text-sm font-semibold text-accent">http://{displayHost}</p>
      {/if}
    </div>
    <p class="text-sm text-text-dim">{$_('wizard.wifi.intro')}</p>

    <div>
      <Button
        label={scanning ? $_('config.network.scanning') : $_('config.network.scan')}
        variant="ghost"
        disabled={scanning}
        onclick={scanWifi}
      />
    </div>

    {#if scanError}
      <p class="text-sm text-error">{$_('config.network.scan_error')}</p>
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
    {:else if !scanning}
      <p class="text-sm text-text-dim">{$_('wizard.wifi.empty')}</p>
    {/if}

    <div class="border-t border-border pt-4">
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
</div>
