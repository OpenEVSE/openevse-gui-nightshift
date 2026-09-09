<!-- src/routes/settings/Cloud.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { certificate_store } from '../../lib/stores/certificates.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import { serialQueue } from '../../lib/queue.js'
  import {
    cloudStatus,
    identityState,
    isThingName,
    droppedCount,
  } from '../../lib/cloud/cloud.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'

  // The charger's own documentation for this connection. Kept as the one
  // explanation of what the cloud client is, so this page does not restate it.
  //
  // Deliberately the upstream master path, not the branch this was written
  // against: a fork/branch URL rots the day that branch merges. It resolves
  // once the firmware lands, and until then nobody has a build that shows this
  // page — the page only exists on firmware compiled with the cloud client,
  // which is the same merge that brings the document to master.
  const DOC_URL =
    'https://github.com/OpenEVSE/openevse_esp32_firmware/blob/master/docs/user/cloud.md'

  const form = createConfigForm()
  const ss = form.saveState

  // ── Live cloud status ─────────────────────────────────────────────────────
  // The firmware never pushes the cloud fields on the WebSocket delta stream —
  // they are built only for GET /status and for the single snapshot sent on WS
  // connect. So they are fresh at page load and stale from then on unless this
  // page polls for itself, exactly as the MQTT page polls GET /mqtt.
  //
  // The poll response is kept local rather than merged into status_store: the
  // store's merge is a shallow spread and cloud_dropped is omitted when zero,
  // so a value seen once would stick there until reload.
  let statusData = $state(null)

  async function refreshCloudStatus() {
    // The device web server is single-threaded — route through serialQueue so
    // this poll can't collide with concurrent store downloads (see queue.js).
    const res = await serialQueue.add(() => httpAPI('GET', '/status'))
    // Only accept a response that actually carries the cloud fields, so an old
    // firmware's generic error JSON can't blank the page.
    if (res && res !== 'error' && 'cloud_connected' in res) {
      statusData = res
    }
  }

  $effect(() => {
    refreshCloudStatus()
    const poll = setInterval(refreshCloudStatus, 10_000)
    return () => clearInterval(poll)
  })

  let connected = $derived(
    !!(statusData?.cloud_connected ?? $status_store?.cloud_connected),
  )
  let reportedThing = $derived(statusData?.cloud_thing ?? $status_store?.cloud_thing ?? '')
  let dropped = $derived(droppedCount(statusData, $status_store))

  let status = $derived(cloudStatus($config_store, connected))
  let identity = $derived(identityState($config_store, reportedThing))

  const STATUS_COLOR = {
    disabled: 'text-text-dim',
    unclaimed: 'text-text-dim',
    interval_zero: 'text-warning',
    disconnected: 'text-error',
    connected: 'text-accent',
  }
  const STATUS_I18N = {
    disabled: 'config.cloud.status_disabled',
    unclaimed: 'config.cloud.status_unclaimed',
    interval_zero: 'config.cloud.status_interval_zero',
    disconnected: 'config.cloud.status_disconnected',
    connected: 'config.cloud.status_connected',
  }
  const IDENTITY_TONE = {
    active: 'default',
    pending: 'warn',
    invalid: 'error',
    unclaimed: 'default',
  }

  let identityDetail = $derived(
    identity.state === 'pending'
      ? $_('config.cloud.identity_pending')
      : identity.state === 'invalid'
        ? $_('config.cloud.identity_invalid')
        : '',
  )

  // ── Provisioning fields ───────────────────────────────────────────────────
  // Server, port, identity and certificate are written by the claiming app,
  // not typed in by hand, and a typo in any of them is a charger that
  // reconnect-loops with nothing in the log. So the default view is read-only
  // and editing them is a deliberate act.
  let editing = $state(false)

  let certOptions = $derived([
    { value: '', label: $_('config.cloud.cert_none') },
    ...($certificate_store ?? [])
      .filter((c) => c.type === 'client')
      .map((c) => ({ value: String(c.id), label: c.name })),
  ])
  let certName = $derived(
    ($certificate_store ?? []).find(
      (c) => String(c.id) === String($config_store?.cloud_certificate_id ?? ''),
    )?.name ?? '',
  )

  // Validation is the firmware's own rule and nothing more: the GUI refuses a
  // malformed name rather than deriving one of its own.
  let thingDraftError = $state(null)
  function saveThing(v) {
    const value = String(v ?? '').trim()
    // Clearing the field is legitimate — the firmware then derives the name
    // from the WiFi MAC address itself.
    if (value === '') {
      thingDraftError = null
      return form.saveField('cloud_thing', '')
    }
    const check = isThingName(value)
    if (!check.ok) {
      thingDraftError = check.msgKey
      return
    }
    thingDraftError = null
    return form.saveField('cloud_thing', value)
  }
</script>

<ConfigPage title={$_('config.pages.cloud')}>
  <ConfigSection>
    <FormField label={$_('config.cloud.enable')} description={$_('config.cloud.enable_desc')}>
      <Toggle
        checked={!!$config_store?.cloud_enabled}
        label={$_('config.cloud.enable')}
        onchange={(v) => form.saveField('cloud_enabled', v)}
      />
    </FormField>

    <div class="flex items-center justify-between gap-3 py-2 text-sm">
      <span class="text-text-dim">{$_('config.cloud.status_label')}</span>
      <span class="font-semibold {STATUS_COLOR[status] ?? 'text-text'}">
        {$_(STATUS_I18N[status] ?? 'config.cloud.status_disconnected')}
      </span>
    </div>

    <ReadOnlyRow
      label={$_('config.cloud.identity')}
      value={identity.state === 'unclaimed' ? $_('config.cloud.identity_unclaimed') : identity.value}
      detail={identityDetail}
      tone={IDENTITY_TONE[identity.state]}
    />

    {#if dropped > 0}
      <ReadOnlyRow
        label={$_('config.cloud.dropped')}
        value={dropped}
        detail={$_('config.cloud.dropped_desc')}
        tone="warn"
      />
    {/if}
  </ConfigSection>

  <ConfigSection title={$_('config.cloud.provisioning')}>
    <p class="py-1 text-xs text-text-dim">{$_('config.cloud.provisioning_desc')}</p>

    {#if editing}
      <FormField label={$_('config.cloud.server')} status={$ss.cloud_server ?? 'idle'}>
        <TextInput
          value={$config_store?.cloud_server ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('cloud_server', v)}
        />
      </FormField>
      <FormField label={$_('config.cloud.port')} status={$ss.cloud_port ?? 'idle'}>
        <NumberInput
          value={$config_store?.cloud_port ?? null}
          placeholder="8883"
          revert={form.revert}
          onchange={(v) => form.saveField('cloud_port', v)}
        />
      </FormField>
      <FormField
        label={$_('config.cloud.thing')}
        description={thingDraftError ? $_(thingDraftError) : $_('config.cloud.thing_desc')}
        status={$ss.cloud_thing ?? 'idle'}
      >
        <TextInput
          value={$config_store?.cloud_thing ?? ''}
          placeholder="evse-aabbccddeeff"
          revert={form.revert}
          onchange={saveThing}
        />
      </FormField>
      <FormField label={$_('config.cloud.certificate')} status={$ss.cloud_certificate_id ?? 'idle'}>
        <Select
          options={certOptions}
          value={String($config_store?.cloud_certificate_id ?? '')}
          onchange={(v) => form.saveField('cloud_certificate_id', v)}
        />
      </FormField>
    {:else}
      <ReadOnlyRow label={$_('config.cloud.server')} value={$config_store?.cloud_server ?? ''} />
      <ReadOnlyRow label={$_('config.cloud.port')} value={$config_store?.cloud_port ?? ''} />
      <ReadOnlyRow
        label={$_('config.cloud.certificate')}
        value={certName || $_('config.cloud.cert_none')}
      />
    {/if}

    <button
      type="button"
      onclick={() => { editing = !editing; thingDraftError = null }}
      class="mt-1 text-xs text-text-dim hover:text-text"
    >
      {editing ? $_('config.cloud.edit_done') : $_('config.cloud.edit')}
    </button>
  </ConfigSection>

  <ConfigSection title={$_('config.cloud.telemetry')}>
    <FormField
      label={$_('config.cloud.interval')}
      description={$_('config.cloud.interval_desc')}
      status={$ss.cloud_agent_interval ?? 'idle'}
    >
      <NumberInput
        value={$config_store?.cloud_agent_interval ?? null}
        min={0}
        placeholder="60"
        revert={form.revert}
        onchange={(v) => form.saveField('cloud_agent_interval', v)}
      />
    </FormField>
  </ConfigSection>

  <a
    href={DOC_URL}
    target="_blank"
    rel="noopener noreferrer"
    class="text-sm text-text-dim hover:text-accent"
  >
    {$_('config.cloud.learn_more')}
  </a>
</ConfigPage>
