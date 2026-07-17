<!-- src/routes/settings/LoadSharing.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { claims_target_store } from '../../lib/stores/claims_target.js'
  import { loadsharing_store } from '../../lib/stores/loadsharing.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import { EvseClients } from '../../lib/vars.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'
  import Button from '../../lib/components/ui/Button.svelte'
  import IconButton from '../../lib/components/ui/IconButton.svelte'
  import Modal from '../../lib/components/ui/Modal.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let peerHost = $state('')
  let peersBusy = $state(false)
  let detailsPeer = $state(null)

  let enabled = $derived(!!$config_store?.loadsharing_enabled)
  let role = $derived($config_store?.loadsharing_role ?? '')
  let isMember = $derived(enabled && role === 'member')
  let isController = $derived(enabled && role === 'controller')
  let roleOptions = $derived([
    { value: 'controller', label: $_('config.loadsharing.role_controller') },
    { value: 'member', label: $_('config.loadsharing.role_member') },
  ])
  let failsafeModeOptions = $derived([
    { value: 'safe_current', label: $_('config.loadsharing.failsafe_safe_current') },
    { value: 'disable', label: $_('config.loadsharing.failsafe_disable') },
  ])

  let peers = $derived(
    Array.isArray($loadsharing_store?.status?.peers) && $loadsharing_store.status.peers.length > 0
      ? $loadsharing_store.status.peers
      : ($loadsharing_store?.peers ?? []),
  )
  let allocations = $derived($loadsharing_store?.status?.allocations ?? [])
  let runtimeStatus = $derived($loadsharing_store?.status ?? {})
  let hasSafetyFactor = $derived($config_store?.loadsharing_safety_factor !== undefined)
  let hasHeartbeatTimeout = $derived($config_store?.loadsharing_heartbeat_timeout !== undefined)
  let hasFailsafeMode = $derived($config_store?.loadsharing_failsafe_mode !== undefined)
  let hasFailsafeSafeCurrent = $derived($config_store?.loadsharing_failsafe_safe_current !== undefined)
  let hasFailsafePeerAssumedCurrent = $derived(
    $config_store?.loadsharing_failsafe_peer_assumed_current !== undefined,
  )

  let controllerHost = $derived($config_store?.loadsharing_controller_host ?? '')
  let controllerPeer = $derived(
    peers.find((p) => (p.host ?? p.name ?? '').toLowerCase() === controllerHost.toLowerCase()),
  )
  let controllerName = $derived(
    controllerPeer?.name ||
      controllerHost ||
      $_('config.loadsharing.unknown'),
  )
  let controllerId = $derived(
    controllerPeer?.id ??
      $_('config.loadsharing.unknown'),
  )
  let controllerUrl = $derived(
    controllerHost ? `http://${controllerHost}` : '',
  )
  let memberAssignedLimit = $derived(
    $claims_target_store?.claims?.max_current === EvseClients.shaper.id
      ? $claims_target_store?.properties?.max_current ?? null
      : null,
  )
  let memberComms = $derived(
    controllerHost
      ? controllerPeer?.online === true
        ? $_('config.connected')
        : controllerPeer?.online === false
          ? $_('config.not_connected')
          : $_('config.loadsharing.unknown')
      : $_('config.loadsharing.unknown'),
  )

  function allocatedFor(peer) {
    const key = peer.id ?? peer.host ?? peer.name
    const hit = allocations.find((a) => a.id === key || a.id === peer.host || a.id === peer.name)
    return hit?.target_current
  }

  function reasonFor(peer) {
    const key = peer.id ?? peer.host ?? peer.name
    const hit = allocations.find((a) => a.id === key || a.id === peer.host || a.id === peer.name)
    return hit?.reason ?? '—'
  }

  function statusFor(peer) {
    const states = {
      1: $_('config.loadsharing.state_idle'),
      2: $_('config.loadsharing.state_connected'),
      3: $_('config.loadsharing.state_charging'),
      254: $_('config.loadsharing.state_sleeping'),
    }
    if (peer?.status?.state !== undefined) {
      return states[peer.status.state] ?? $_('config.loadsharing.unknown')
    }
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

  async function addPeer(host) {
    const targetHost = (typeof host === 'string' ? host : peerHost ?? '').trim()
    if (!targetHost) return
    peersBusy = true
    try {
      const ok = await loadsharing_store.addPeer(targetHost)
      if (ok) {
        if (targetHost === peerHost) {
          peerHost = ''
        }
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

  $effect(() => {
    if (!enabled) return
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
        disabled={isMember}
        label={$_('config.loadsharing.enable')}
        onchange={(v) => form.saveField('loadsharing_enabled', v)}
      />
    </FormField>
  </ConfigSection>

  {#if enabled}
    {#if !isMember}
    <ConfigSection title={$_('config.loadsharing.settings')}>
      <FormField label={$_('config.loadsharing.group_id')} status={$ss.loadsharing_group_id ?? 'idle'}>
        <TextInput
          value={$config_store?.loadsharing_group_id ?? ''}
          placeholder="main_circuit"
          revert={form.revert}
          onchange={(v) => form.saveField('loadsharing_group_id', v)}
        />
      </FormField>
      <FormField label={$_('config.loadsharing.role')} status={$ss.loadsharing_role ?? 'idle'}>
        <Select
          options={roleOptions}
          value={role}
          onchange={(v) => form.saveField('loadsharing_role', v)}
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
      {#if hasSafetyFactor}
        <FormField
          label={$_('config.loadsharing.safety_factor')}
          status={$ss.loadsharing_safety_factor ?? 'idle'}
        >
          <NumberInput
            value={$config_store?.loadsharing_safety_factor ?? null}
            min={0}
            step={0.01}
            revert={form.revert}
            onchange={(v) => form.saveField('loadsharing_safety_factor', v)}
          />
        </FormField>
      {/if}
      {#if hasHeartbeatTimeout}
        <FormField
          label={$_('config.loadsharing.heartbeat_timeout')}
          status={$ss.loadsharing_heartbeat_timeout ?? 'idle'}
        >
          <NumberInput
            value={$config_store?.loadsharing_heartbeat_timeout ?? null}
            min={0}
            step={1}
            revert={form.revert}
            onchange={(v) => form.saveField('loadsharing_heartbeat_timeout', v)}
          />
        </FormField>
      {/if}
      {#if hasFailsafeMode}
        <FormField
          label={$_('config.loadsharing.failsafe_mode')}
          status={$ss.loadsharing_failsafe_mode ?? 'idle'}
        >
          <Select
            options={failsafeModeOptions}
            value={$config_store?.loadsharing_failsafe_mode ?? 'safe_current'}
            onchange={(v) => form.saveField('loadsharing_failsafe_mode', v)}
          />
        </FormField>
      {/if}
      {#if hasFailsafeSafeCurrent}
        <FormField
          label={$_('config.loadsharing.failsafe_safe_current')}
          status={$ss.loadsharing_failsafe_safe_current ?? 'idle'}
        >
          <NumberInput
            value={$config_store?.loadsharing_failsafe_safe_current ?? null}
            min={0}
            step={0.1}
            revert={form.revert}
            onchange={(v) => form.saveField('loadsharing_failsafe_safe_current', v)}
          />
        </FormField>
      {/if}
      {#if hasFailsafePeerAssumedCurrent}
        <FormField
          label={$_('config.loadsharing.failsafe_peer_assumed_current')}
          status={$ss.loadsharing_failsafe_peer_assumed_current ?? 'idle'}
        >
          <NumberInput
            value={$config_store?.loadsharing_failsafe_peer_assumed_current ?? null}
            min={0}
            step={0.1}
            revert={form.revert}
            onchange={(v) => form.saveField('loadsharing_failsafe_peer_assumed_current', v)}
          />
        </FormField>
      {/if}
      <FormField
        label={$_('config.loadsharing.priority')}
        status={$ss.loadsharing_priority ?? 'idle'}
      >
        <NumberInput
          value={$config_store?.loadsharing_priority ?? 0}
          min={0}
          step={1}
          revert={form.revert}
          onchange={(v) => form.saveField('loadsharing_priority', v)}
        />
      </FormField>
      <FormField
        label={$_('config.loadsharing.rotation_interval')}
        status={$ss.loadsharing_rotation_interval ?? 'idle'}
      >
        <NumberInput
          value={$config_store?.loadsharing_rotation_interval ?? 1800}
          min={0}
          step={1}
          revert={form.revert}
          onchange={(v) => form.saveField('loadsharing_rotation_interval', v)}
        />
      </FormField>
    </ConfigSection>
    {/if}

    <ConfigSection title={$_('config.loadsharing.runtime_status')}>
      <ReadOnlyRow
        label={$_('config.loadsharing.failsafe_active')}
        value={runtimeStatus.failsafe_active
          ? $_('config.loadsharing.active')
          : $_('config.loadsharing.inactive')}
      />
      <ReadOnlyRow
        label={$_('config.loadsharing.online_count')}
        value={runtimeStatus.online_count ?? '—'}
      />
      <ReadOnlyRow
        label={$_('config.loadsharing.offline_count')}
        value={runtimeStatus.offline_count ?? '—'}
      />
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
            onclick={() => addPeer()}
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
                  <th class="px-3 py-2 text-left font-medium">{$_('config.loadsharing.peer_host')}</th>
                  <th class="px-3 py-2 text-left font-medium">{$_('config.loadsharing.peer_online')}</th>
                  <th class="px-3 py-2 text-left font-medium">{$_('config.loadsharing.peer_status')}</th>
                  <th class="px-3 py-2 text-right font-medium">{$_('config.loadsharing.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {#each peers as peer}
                  {@const host = peer.host ?? peer.ip ?? peer.name ?? ''}
                  <tr class="border-t border-border">
                    <td class="px-3 py-2 text-text">{host || '—'}</td>
                    <td class="px-3 py-2">
                      <span class={peer.online ? 'text-accent' : 'text-text-dim'}>
                        {peer.online
                          ? $_('config.loadsharing.peer_online_value')
                          : $_('config.loadsharing.peer_offline_value')}
                      </span>
                    </td>
                    <td class="px-3 py-2 text-text">{statusFor(peer)}</td>
                    <td class="px-3 py-2">
                      <div class="flex justify-end gap-1">
                        <IconButton
                          icon="mdi:information-outline"
                          label={$_('config.loadsharing.peer_details')}
                          onclick={() => (detailsPeer = peer)}
                        />
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
                        {:else}
                          <IconButton
                            icon="mdi:plus"
                            label={$_('config.loadsharing.add_peer')}
                            disabled={peersBusy}
                            onclick={() => addPeer(host)}
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
    {:else if isMember}
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
          label={$_('config.loadsharing.assigned_limit')}
          value={memberAssignedLimit !== null && memberAssignedLimit !== undefined ? `${memberAssignedLimit} A` : '—'}
        />
        <ReadOnlyRow label={$_('config.loadsharing.comms_status')} value={memberComms} />
      </ConfigSection>
    {:else}
      <ConfigSection title={$_('config.loadsharing.settings')}>
        <p class="text-sm text-text-dim">{$_('config.loadsharing.role_required')}</p>
      </ConfigSection>
    {/if}
  {/if}

  <Modal visible={!!detailsPeer} closable={true} onclose={() => (detailsPeer = null)}>
    {#if detailsPeer}
      {@const host = detailsPeer.host ?? detailsPeer.ip ?? detailsPeer.name ?? ''}
      {@const allocated = allocatedFor(detailsPeer)}
      <div class="p-4">
        <h2 class="mb-4 text-base font-semibold text-text">
          {$_('config.loadsharing.peer_details')}
        </h2>
        <div class="divide-y divide-border/40">
          <ReadOnlyRow label={$_('config.loadsharing.peer_name')} value={detailsPeer.name} />
          <ReadOnlyRow label={$_('config.loadsharing.peer_host')} value={host} />
          <ReadOnlyRow label={$_('config.loadsharing.peer_id')} value={detailsPeer.id} />
          <ReadOnlyRow
            label={$_('config.loadsharing.peer_online')}
            value={detailsPeer.online ? $_('config.connected') : $_('config.not_connected')}
          />
          <ReadOnlyRow
            label={$_('config.loadsharing.peer_allocated')}
            value={allocated !== undefined && allocated !== null ? `${allocated} A` : '—'}
          />
          <ReadOnlyRow label={$_('config.loadsharing.peer_reason')} value={reasonFor(detailsPeer)} />
          <ReadOnlyRow label={$_('config.loadsharing.peer_status')} value={statusFor(detailsPeer)} />
        </div>
        <div class="mt-5 flex justify-end">
          <Button label={$_('config.loadsharing.close')} onclick={() => (detailsPeer = null)} />
        </div>
      </div>
    {/if}
  </Modal>
</ConfigPage>
