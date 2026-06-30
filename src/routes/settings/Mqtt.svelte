<!-- src/routes/settings/Mqtt.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { certificate_store } from '../../lib/stores/certificates.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import { serialQueue } from '../../lib/queue.js'
  import { formatDuration, formatAgo } from '../../lib/format/duration.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import PasswordInput from '../../lib/components/ui/PasswordInput.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'
  import Button from '../../lib/components/ui/Button.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  let enabled = $derived(!!$config_store?.mqtt_enabled)
  let isTls = $derived($config_store?.mqtt_protocol === 'mqtts')
  let protocolOptions = $derived(
    ($config_store?.mqtt_supported_protocols ?? []).map((p) => ({ value: p, label: p })),
  )
  let certOptions = $derived([
    { value: '', label: $_('config.mqtt.cert_none') },
    ...($certificate_store ?? [])
      .filter((c) => c.type === 'client')
      .map((c) => ({ value: String(c.id), label: c.name })),
  ])

  // ── Live MQTT status (polled + WebSocket merged) ─────────────────────────
  // Polled snapshot from GET /mqtt — authoritative; merges every 10 s
  let mqttData = $state(null)

  async function refreshMqttStatus() {
    // The device web server is single-threaded — route through serialQueue so
    // this poll can't collide with concurrent store downloads (see queue.js).
    const res = await serialQueue.add(() => httpAPI('GET', '/mqtt'))
    // Only accept responses that include mqtt_connected — guards against old
    // firmware returning a generic 404 JSON that would corrupt mqttData.
    if (res && res !== 'error' && 'mqtt_connected' in res) {
      mqttData = res
    }
  }

  // Live clock for counting-up timers
  let nowMs = $state(Date.now())

  $effect(() => {
    refreshMqttStatus()
    const poll = setInterval(refreshMqttStatus, 10_000)
    const tick = setInterval(() => { nowMs = Date.now() }, 1000)
    return () => { clearInterval(poll); clearInterval(tick) }
  })

  // Merge: prefer freshly-polled data, fall back to WebSocket-pushed store values
  let brokerIp       = $derived(mqttData?.mqtt_broker_ip       ?? $status_store?.mqtt_broker_ip       ?? null)
  let brokerVersion  = $derived(mqttData?.mqtt_broker_version  ?? $status_store?.mqtt_broker_version  ?? null)
  let connectedSince = $derived(mqttData?.mqtt_connected_since ?? $status_store?.mqtt_connected_since ?? 0)
  let lastRxTime     = $derived(mqttData?.mqtt_last_rx         ?? $status_store?.mqtt_last_rx         ?? 0)
  let errorCategory  = $derived(mqttData?.mqtt_error           ?? $status_store?.mqtt_error           ?? '')
  let errorDetail    = $derived(mqttData?.mqtt_error_detail    ?? $status_store?.mqtt_error_detail    ?? '')

  // The firmware flag is authoritative when true. But because the connection can
  // briefly drop between polls, we also treat "received an MQTT message within the
  // last 45 s" as proof the link is live — if data is flowing, we're connected.
  let flagConnected = $derived(!!(mqttData?.mqtt_connected ?? $status_store?.mqtt_connected))
  let recentlyReceived = $derived(
    lastRxTime > 0 && (Math.floor(nowMs / 1000) - lastRxTime) < 45,
  )
  let isConnected = $derived(flagConnected || recentlyReceived)

  // Derive connection label: connected if the flag says so OR data is flowing;
  // mqtt_status only used for the "connecting" intermediate state.
  let mqttStatus = $derived.by(() => {
    if (!enabled) return 'disabled'
    if (isConnected) return 'connected'
    const s = mqttData?.mqtt_status ?? $status_store?.mqtt_status
    if (s === 'connecting') return 'connecting'
    return 'disconnected'
  })

  const STATUS_COLOR = {
    disabled:     'text-text-dim',
    disconnected: 'text-error',
    connecting:   'text-warning',
    connected:    'text-accent',
  }
  const STATUS_I18N = {
    disabled:     'config.mqtt.status_disabled',
    disconnected: 'config.mqtt.status_disconnected',
    connecting:   'config.mqtt.status_connecting',
    connected:    'config.mqtt.status_connected',
  }
  const ERROR_I18N = {
    auth:        'config.mqtt.err_auth',
    unavailable: 'config.mqtt.err_unavailable',
    id_rejected: 'config.mqtt.err_id_rejected',
    version:     'config.mqtt.err_version',
    network:     'config.mqtt.err_network',
    timeout:     'config.mqtt.err_timeout',
    dns:         'config.mqtt.err_dns',
  }

  // Human-readable failure reason — only meaningful while disconnected
  let errorReason = $derived(
    mqttStatus === 'disconnected' && errorCategory && ERROR_I18N[errorCategory]
      ? $_(ERROR_I18N[errorCategory])
      : null,
  )
  // Show the raw broker/transport detail when it adds information beyond the category
  let errorDetailText = $derived(
    mqttStatus === 'disconnected' && errorDetail && errorDetail !== 'CLOSED'
      ? errorDetail
      : null,
  )

  // Connected-since: formatted time + elapsed detail (counts up)
  let connectedSinceStr = $derived(
    connectedSince > 0 ? new Date(connectedSince * 1000).toLocaleString() : null,
  )
  let connectedElapsed = $derived(
    connectedSince ? formatDuration(nowMs / 1000 - connectedSince) : '',
  )

  // Last-message counting-up elapsed time
  let lastRxElapsed = $derived(formatAgo(lastRxTime, nowMs))
  // ── end MQTT status ───────────────────────────────────────────────────────

  // Reset MQTT connection: force immediate reconnect and refresh status
  let resetBusy = $state(false)
  async function resetMqtt() {
    if (resetBusy) return
    resetBusy = true
    // Optimistically show "Connecting" while the reset is in-flight
    mqttData = { ...(mqttData ?? {}), mqtt_connected: 0, mqtt_status: 'connecting' }
    try {
      await serialQueue.add(() => httpAPI('POST', '/mqtt', '{}'))
      // Poll every second for up to 15 s to pick up the reconnected state.
      // The reconnect path includes: MG_EV_CLOSE → loop → TCP connect → CONNACK,
      // which can take several seconds if DNS is not in LwIP's cache.
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 1000))
        await refreshMqttStatus()
        if (mqttData?.mqtt_connected) break
      }
    } finally {
      resetBusy = false
    }
  }
</script>

<ConfigPage title={$_('config.pages.mqtt')}>
  <ConfigSection>
    <FormField label={$_('config.mqtt.enable')}>
      <Toggle
        checked={enabled}
        label={$_('config.mqtt.enable')}
        onchange={(v) => form.saveField('mqtt_enabled', v)}
      />
    </FormField>

    {#if enabled}
      <!-- Colour-coded connection status — same pattern as NTP status card -->
      <div class="flex items-center justify-between gap-3 py-2 text-sm">
        <span class="text-text-dim">{$_('config.mqtt.status_label')}</span>
        <span class="font-semibold {STATUS_COLOR[mqttStatus] ?? 'text-text'}">
          {$_(STATUS_I18N[mqttStatus] ?? 'config.mqtt.status_disconnected')}
          {#if mqttStatus === 'connected'}✓{/if}
        </span>
      </div>

      <!-- Failure reason — only while disconnected with a known cause -->
      {#if errorReason}
        <ReadOnlyRow
          label={$_('config.mqtt.reason_label')}
          value={errorReason}
          detail={errorDetailText}
          tone="error"
        />
      {/if}

      <!-- Connection details — only meaningful while connected -->
      {#if mqttStatus === 'connected'}
        {#if brokerVersion}
          <ReadOnlyRow label={$_('config.mqtt.broker_version')} value={brokerVersion} />
        {/if}
        <ReadOnlyRow
          label={$_('config.mqtt.connected_since')}
          value={connectedSinceStr ?? '—'}
          detail={connectedElapsed}
        />
        <ReadOnlyRow
          label={$_('config.mqtt.last_rx')}
          value={lastRxElapsed ?? $_('config.mqtt.rx_never')}
        />
      {/if}

      <div class="mt-1 flex justify-end">
        <Button
          label={resetBusy ? $_('config.mqtt.status_connecting') : $_('config.mqtt.reset')}
          variant="ghost"
          disabled={resetBusy}
          onclick={resetMqtt}
        />
      </div>
    {/if}
  </ConfigSection>

  {#if enabled}
    <ConfigSection title={$_('config.mqtt.broker')}>
      <FormField label={$_('config.mqtt.protocol')} status={$ss.mqtt_protocol ?? 'idle'}>
        <Select
          options={protocolOptions}
          value={$config_store?.mqtt_protocol ?? ''}
          onchange={(v) => form.saveField('mqtt_protocol', v)}
        />
      </FormField>
      <FormField label={$_('config.mqtt.server')} status={$ss.mqtt_server ?? 'idle'}>
        <!-- DNS badge inside field — same style as NTP hostname field -->
        <div class="flex flex-col gap-1.5">
          <TextInput
            value={$config_store?.mqtt_server ?? ''}
            placeholder="server IP / hostname"
            revert={form.revert}
            onchange={(v) => form.saveField('mqtt_server', v)}
          />
          {#if brokerIp}
            <span class="inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium
              {brokerIp === 'failed'
                ? 'bg-error/15 text-error'
                : 'bg-accent/15 text-accent'}">
              {brokerIp === 'failed'
                ? $_('config.mqtt.dns_failed')
                : $_('config.mqtt.dns_ok') + brokerIp}
            </span>
          {/if}
        </div>
      </FormField>
      <FormField label={$_('config.mqtt.port')} status={$ss.mqtt_port ?? 'idle'}>
        <NumberInput
          value={$config_store?.mqtt_port ?? null}
          placeholder="1883"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_port', v)}
        />
      </FormField>
      <FormField label={$_('config.mqtt.password')} status={$ss.mqtt_pass ?? 'idle'}>
        <PasswordInput
          value={$config_store?.mqtt_pass ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_pass', v)}
        />
      </FormField>
    </ConfigSection>

    {#if isTls}
      <ConfigSection title={$_('config.mqtt.tls')}>
        <FormField label={$_('config.mqtt.reject_unauthorized')}>
          <Toggle
            checked={!!$config_store?.mqtt_reject_unauthorized}
            label={$_('config.mqtt.reject_unauthorized')}
            onchange={(v) => form.saveField('mqtt_reject_unauthorized', v)}
          />
        </FormField>
        <FormField label={$_('config.mqtt.certificate')} status={$ss.mqtt_certificate_id ?? 'idle'}>
          <Select
            options={certOptions}
            value={String($config_store?.mqtt_certificate_id ?? '')}
            onchange={(v) => form.saveField('mqtt_certificate_id', v)}
          />
        </FormField>
      </ConfigSection>
    {/if}

    <ConfigSection title={$_('config.mqtt.topics')}>
      <FormField
        label={$_('config.mqtt.topic')}
        description={$_('config.mqtt.topic_desc')}
        status={$ss.mqtt_topic ?? 'idle'}
      >
        <TextInput
          value={$config_store?.mqtt_topic ?? ''}
          placeholder="openevse"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_topic', v)}
        />
      </FormField>
      <FormField
        label={$_('config.mqtt.announce')}
        description={$_('config.mqtt.announce_desc')}
        status={$ss.mqtt_announce_topic ?? 'idle'}
      >
        <TextInput
          value={$config_store?.mqtt_announce_topic ?? ''}
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_announce_topic', v)}
        />
      </FormField>
      <FormField label={$_('config.mqtt.retained')}>
        <Toggle
          checked={!!$config_store?.mqtt_retained}
          label={$_('config.mqtt.retained')}
          onchange={(v) => form.saveField('mqtt_retained', v)}
        />
      </FormField>
      <FormField
        label={$_('config.mqtt.vrms')}
        description={$_('config.mqtt.vrms_desc')}
        status={$ss.mqtt_vrms ?? 'idle'}
      >
        <TextInput
          value={$config_store?.mqtt_vrms ?? ''}
          placeholder="topic/voltage"
          revert={form.revert}
          onchange={(v) => form.saveField('mqtt_vrms', v)}
        />
      </FormField>
    </ConfigSection>
  {/if}
</ConfigPage>
