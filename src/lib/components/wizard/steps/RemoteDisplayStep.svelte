<!--
  src/lib/components/wizard/steps/RemoteDisplayStep.svelte

  Remote-display builds only: pick the OpenEVSE station this panel mirrors.
  The address (IP or .local name) is stored in remote_display_host; the
  firmware's display client polls http://<host>/status with it.

  Discovery runs on the DEVICE, not the browser (browsers can't do mDNS):
  GET /remotedisplay/scan makes the firmware query _openevse._tcp.local and
  return whatever stations answered. mDNS doesn't cross subnets, so a manual
  address entry always remains available.
-->
<script>
  import { onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../../stores/config.js'
  import { status_store } from '../../../stores/status.js'
  import { serialQueue } from '../../../queue.js'
  import { httpAPI } from '../../../api/httpAPI.js'
  import { createConfigForm } from '../../../config/configForm.svelte.js'
  import FormField from '../../config/FormField.svelte'
  import TextInput from '../../ui/TextInput.svelte'
  import Button from '../../ui/Button.svelte'
  import Icon from '../../../icons/Icon.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let stations = $state([])
  let scanning = $state(false)
  let scanError = $state(false)
  let scanned = $state(false)

  let currentHost = $derived($config_store?.remote_display_host ?? '')

  async function scanStations() {
    if (scanning) return
    scanning = true
    scanError = false
    const res = await serialQueue.add(() => httpAPI('GET', '/remotedisplay/scan'))
    scanning = false
    scanned = true
    if (!res || res === 'error' || !Array.isArray(res)) {
      scanError = true
      stations = []
      return
    }
    // Never offer the display itself (it advertises _openevse._tcp too).
    // Match by hostname as well as IP — a stale mDNS record can carry an
    // old address while the name is still ours.
    const ownIp = $status_store?.ipaddress
    const ownName = $config_store?.hostname
    stations = res.filter(
      (s) => s?.ip && s.ip !== ownIp && (!ownName || s.name !== ownName),
    )
  }

  function pickStation(s) {
    form.saveField('remote_display_host', s.ip)
  }

  onMount(scanStations)
</script>

<div class="space-y-4">
  <p class="text-sm text-text-dim">{$_('wizard.remote.intro')}</p>

  <FormField
    label={$_('wizard.remote.host')}
    status={$ss.remote_display_host ?? 'idle'}
    description={$_('wizard.remote.host_hint')}
  >
    <TextInput
      value={currentHost}
      placeholder="192.168.1.50 / openevse-1234.local"
      revert={form.revert}
      onchange={(v) => form.saveField('remote_display_host', v.trim())}
    />
  </FormField>

  <!-- Stations found on the local network -->
  <div class="rounded-xl border border-border bg-surface-2 p-3">
    <div class="flex items-center justify-between gap-2">
      <p class="text-sm font-semibold text-text">{$_('wizard.remote.found')}</p>
      <Button
        label={scanning ? $_('wizard.remote.scanning') : $_('wizard.remote.scan')}
        variant="ghost"
        disabled={scanning}
        onclick={scanStations}
      />
    </div>

    {#if scanError}
      <p class="mt-2 text-sm text-error">{$_('wizard.remote.scan_error')}</p>
    {:else if stations.length > 0}
      <ul class="mt-1 divide-y divide-border" data-testid="station-list">
        {#each stations as s (s.ip)}
          <li>
            <button
              type="button"
              onclick={() => pickStation(s)}
              class="flex w-full items-center gap-3 py-2 text-left text-sm
                     {currentHost === s.ip ? 'text-accent' : 'text-text'}"
            >
              <Icon icon="mdi:ev-station" size={18} class="text-text-dim" />
              <span class="flex-1">
                <span class="block font-medium">{s.name || s.ip}</span>
                <span class="block text-xs text-text-dim">{s.ip}</span>
              </span>
              {#if currentHost === s.ip}
                <Icon icon="mdi:check" size={16} />
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {:else if scanning}
      <p class="mt-2 text-sm text-text-dim">{$_('wizard.remote.scanning')}</p>
    {:else if scanned}
      <p class="mt-2 text-sm text-text-dim">{$_('wizard.remote.empty')}</p>
    {/if}
  </div>
</div>
