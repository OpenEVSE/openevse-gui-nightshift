<!-- src/routes/settings/LoadSharing.svelte -->
<script>
  import { onMount } from 'svelte'
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { loadsharing_store } from '../../lib/stores/loadsharing.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'
  import Button from '../../lib/components/ui/Button.svelte'
  import IconButton from '../../lib/components/ui/IconButton.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let peerHost = $state('')
  let peersBusy = $state(false)

  let enabled = $derived(!!$config_store?.loadsharing_enabled)
  let role = $derived($config_store?.loadsharing_role ?? '')
  let isMember = $derived(enabled && role === 'member')
  let isController = $derived(enabled && !isMember)

  let peers = $derived(
    Array.isArray($loadsharing_store?.status?.peers) && $loadsharing_store.status.peers.length > 0
      ? $loadsharing_store.status.peers
      : ($loadsharing_store?.peers ?? []),
  )
  let allocations = $derived($loadsharing_store?.status?.allocations ?? [])

  let minCurrentField = $derived(
    $config_store?.loadsharing_min_current_per_evse !== undefined
      ? 'loadsharing_min_current_per_evse'
      : $config_store?.loadsharing_min_current !== undefined
        ? 'loadsharing_min_current'
        : $config_store?.loadsharing_failsafe_peer_assumed_current !== undefined
          ? 'loadsharing_failsafe_peer_assumed_current'
          : 'loadsharing_failsafe_safe_current',
  )
  let minCurrentValue = $derived($config_store?.[minCurrentField] ?? null)

  let controllerHost = $derived($config_store?.loadsharing_controller_host ?? '')
  let controllerPeer = $derived(
    peers.find((p) => (p.host ?? p.name ?? '').toLowerCase() === controllerHost.toLowerCase()),
  )
  let controllerName = $derived(
    $loadsharing_store?.status?.controller?.name ??
      controllerPeer?.name ??
      controllerHost ??
      $_('config.loadsharing.unknown'),
  )
  let controllerId = $derived(
    $loadsharing_store?.status?.controller?.id ??
      controllerPeer?.id ??
      $loadsharing_store?.status?.controller_id ??
      $_('config.loadsharing.unknown'),
  )
  let controllerUrl = $derived(
    $loadsharing_store?.status?.controller?.url ??
      (controllerHost ? `http://${controllerHost}` : ''),
  )
  let memberAssignedLimit = $derived(
    $loadsharing_store?.status?.member?.assigned_limit ??
      $loadsharing_store?.status?.assigned_limit ??
      null,
  )
  let memberLastCommandAge = $derived(
    $loadsharing_store?.status?.member?.last_command_age ??
      $loadsharing_store?.status?.last_command_age ??
      null,
  )
  let memberComms = $derived(
    $loadsharing_store?.status?.member?.comms_status ??
      $loadsharing_store?.status?.comms_status ??
      (controllerPeer?.online ? $_('config.connected') : $_('config.not_connected')),
  )

  function allocatedFor(peer) {
    const key = peer.id ?? peer.host ?? peer.name
    const hit = allocations.find((a) => a.id === key || a.id === peer.host || a.id === peer.name)
    return hit?.target_current
  }

  function statusFor(peer) {
    if (peer?.status?.state !== undefined) return String(peer.status.state)
    if (peer?.joined) return $_('config.loadsharing.joined')
    return $_('config.loadsharing.discovered')
  }

  async function refreshPeers() {
    peersBusy = true
    try {
      await loadsharing_store.refresh()
    } finally {
      peersBusy = false
    }
  }

  async function addPeer() {
    const host = (peerHost ?? '').trim()
    if (!host) return
    peersBusy = true
    try {
      const ok = await loadsharing_store.addPeer(host)
      if (ok) {
        peerHost = ''
        await loadsharing_store.refresh()
      }
    } finally {
      peersBusy = false
    }
  }

  async function removePeer(host) {
    peersBusy = true
    try {
      const ok = await loadsharing_store.removePeer(host)
      if (ok) await loadsharing_store.refresh()
    } finally {
      peersBusy = false
    }
  }

  async function discoverPeers() {
    peersBusy = true
    try {
      await loadsharing_store.discover()
      await loadsharing_store.refresh()
    } finally {
      peersBusy = false
    }
  }

  onMount(() => {
    refreshPeers()
    const id = setInterval(refreshPeers, 10000)
    return () => clearInterval(id)
  })
</script>

<ConfigPage title={$_('config.pages.loadsharing')}>
  <ConfigSection>
    <FormField label={$_('config.loadsharing.enable')}>
      <Toggle
        checked={enabled}
        label={$_('config.loadsharing.enable')}
        onchange={(v) => form.saveField('loadsharing_enabled', v)}
      />
    </FormField>
  </ConfigSection>

  {#if enabled}
    <ConfigSection title={$_('config.loadsharing.settings')}>
      <FormField label={$_('config.loadsharing.group_id')} status={$ss.loadsharing_group_id ?? 'idle'}>
        <TextInput
          value={$config_store?.loadsharing_group_id ?? ''}
          placeholder="main_circuit"
          revert={form.revert}
          onchange={(v) => form.saveField('loadsharing_group_id', v)}
        />
      </FormField>
      <FormField
        label={$_('config.loadsharing.site_max_current')}
        status={$ss.loadsharing_group_max_current ?? 'idle'}
      >
        <NumberInput
          value={$config_store?.loadsharing_group_max_current ?? null}
          min={0}
          step={0.1}
          revert={form.revert}
          onchange={(v) => form.saveField('loadsharing_group_max_current', v)}
        />
      </FormField>
      <FormField
        label={$_('config.loadsharing.min_per_evse_current')}
        status={$ss[minCurrentField] ?? 'idle'}
      >
        <NumberInput
          value={minCurrentValue}
          min={0}
          step={0.1}
          revert={form.revert}
          onchange={(v) => form.saveField(minCurrentField, v)}
        />
      </FormField>
    </ConfigSection>

    {#if isController}
      <ConfigSection title={$_('config.loadsharing.peers')}>
        <div class="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <TextInput
            value={peerHost}
            placeholder="openevse-2.local"
            revert={0}
            onchange={(v) => (peerHost = v)}
          />
          <Button
            label={$_('config.loadsharing.add_peer')}
            disabled={peersBusy || !peerHost.trim()}
            onclick={addPeer}
          />
          <Button
            label={$_('config.loadsharing.discover')}
            variant="ghost"
            disabled={peersBusy}
            onclick={discoverPeers}
          />
          <Button
            label={$_('config.loadsharing.refresh')}
            variant="ghost"
            disabled={peersBusy}
            onclick={refreshPeers}
          />
        </div>

        {#if peers.length > 0}
          <div class="overflow-hidden rounded-xl border border-border">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-surface-3 text-text-dim">
                  <th class="px-3 py-2 text-left font-medium">{$_('config.loadsharing.peer_name')}</th>
                  <th class="px-3 py-2 text-left font-medium">{$_('config.loadsharing.peer_host')}</th>
                  <th class="px-3 py-2 text-left font-medium">{$_('config.loadsharing.peer_id')}</th>
                  <th class="px-3 py-2 text-left font-medium">{$_('config.loadsharing.peer_online')}</th>
                  <th class="px-3 py-2 text-left font-medium">{$_('config.loadsharing.peer_allocated')}</th>
                  <th class="px-3 py-2 text-left font-medium">{$_('config.loadsharing.peer_status')}</th>
                  <th class="px-3 py-2 text-right font-medium">{$_('config.loadsharing.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {#each peers as peer}
                  {@const host = peer.host ?? peer.ip ?? peer.name ?? ''}
                  {@const allocated = allocatedFor(peer)}
                  <tr class="border-t border-border">
                    <td class="px-3 py-2 font-medium text-text">{peer.name ?? '—'}</td>
                    <td class="px-3 py-2 text-text">{host || '—'}</td>
                    <td class="px-3 py-2 text-text">{peer.id ?? '—'}</td>
                    <td class="px-3 py-2">
                      <span class={peer.online ? 'text-accent' : 'text-text-dim'}>
                        {peer.online ? $_('config.connected') : $_('config.not_connected')}
                      </span>
                    </td>
                    <td class="px-3 py-2 text-text">
                      {allocated !== undefined && allocated !== null ? `${allocated} A` : '—'}
                    </td>
                    <td class="px-3 py-2 text-text">{statusFor(peer)}</td>
                    <td class="px-3 py-2">
                      <div class="flex justify-end gap-1">
                        {#if host}
                          <a href={`http://${host}`} target="_blank" rel="noopener noreferrer">
                            <IconButton icon="mdi:open-in-new" label={$_('config.loadsharing.test_peer')} />
                          </a>
                        {/if}
                        {#if peer.joined}
                          <IconButton
                            icon="mdi:trash-can-outline"
                            label={$_('config.loadsharing.remove_peer')}
                            disabled={peersBusy}
                            onclick={() => removePeer(host)}
                          />
                        {/if}
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else}
          <p class="text-sm text-text-dim">{$_('config.loadsharing.no_peers')}</p>
        {/if}
      </ConfigSection>
    {:else}
      <ConfigSection title={$_('config.loadsharing.controlled_by')}>
        <ReadOnlyRow label={$_('config.loadsharing.controller_name')} value={controllerName} />
        <div class="flex items-center justify-between gap-3 py-2 text-sm">
          <span class="text-text-dim">{$_('config.loadsharing.controller_link')}</span>
          {#if controllerUrl}
            <a
              href={controllerUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-accent underline"
            >
              {controllerUrl}
            </a>
          {:else}
            <span class="font-medium text-text">—</span>
          {/if}
        </div>
        <ReadOnlyRow label={$_('config.loadsharing.controller_id')} value={controllerId} />
        <ReadOnlyRow
          label={$_('config.loadsharing.last_command_age')}
          value={memberLastCommandAge !== null && memberLastCommandAge !== undefined ? `${memberLastCommandAge}s` : '—'}
        />
        <ReadOnlyRow
          label={$_('config.loadsharing.assigned_limit')}
          value={memberAssignedLimit !== null && memberAssignedLimit !== undefined ? `${memberAssignedLimit} A` : '—'}
        />
        <ReadOnlyRow label={$_('config.loadsharing.comms_status')} value={memberComms} />
      </ConfigSection>
    {/if}
  {/if}
</ConfigPage>
