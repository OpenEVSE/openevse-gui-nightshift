<!-- src/routes/settings/Time.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import { serialQueue } from '../../lib/queue.js'
  import { showWriteError } from '../../lib/alerts.js'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import { createTzObj } from '../../lib/utils.js'
  import zones from '../../lib/config/zones.json'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import TextInput from '../../lib/components/ui/TextInput.svelte'
  import Select from '../../lib/components/ui/Select.svelte'
  import Button from '../../lib/components/ui/Button.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  const tzOptions = createTzObj(zones).map((z) => ({ value: z.value, label: z.name }))
  const sourceOptions = [
    { value: 'manual', label: $_('config.time.manual') },
    { value: 'ntp', label: $_('config.time.ntp') },
  ]

  let isNtp = $derived(!!$config_store?.sntp_enabled)
  let busy = $state(false)

  // ── NTP status card ──────────────────────────────────────────────────────
  let ntpData = $state(null)       // response from GET /time
  let ntpFetchedAt = $state(0)     // Date.now() when ntpData arrived
  let nowMs = $state(Date.now())   // ticks every second for live countdowns
  let syncBusy = $state(false)
  let shownIp = $state(null)       // DNS badge; cleared when hostname changes

  // Clear the DNS badge whenever the configured NTP hostname changes
  $effect(() => {
    void $config_store?.sntp_hostname
    shownIp = null
  })

  async function refreshNtpStatus() {
    // The device web server is single-threaded — route through serialQueue so
    // this poll can't collide with concurrent store downloads (see queue.js).
    const res = await serialQueue.add(() => httpAPI('GET', '/time'))
    if (res && res !== 'error') {
      ntpData = res
      ntpFetchedAt = Date.now()
      shownIp = res.ntp_server_ip ?? null
    }
  }

  async function syncNow() {
    if (syncBusy) return
    syncBusy = true
    shownIp = null   // clear DNS badge immediately on every Update Now press
    try {
      const res = await serialQueue.add(() =>
        httpAPI('POST', '/time', JSON.stringify({ sync_now: true }))
      )
      if (!res || res === 'error') { showWriteError(); return }
      // Poll at 500 ms intervals while connecting — the firmware does an early
      // DNS probe at 1 s, so the badge appears within ~1.5 s of pressing the
      // button.  Continue for up to 25 polls (~12 s) to cover slow servers;
      // the background 30 s poll handles anything beyond that.
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, i === 0 ? 300 : 500))
        await refreshNtpStatus()
        if (ntpData?.ntp_status !== 'connecting') break
      }
    } finally {
      syncBusy = false
    }
  }

  $effect(() => {
    refreshNtpStatus()
    const poll = setInterval(refreshNtpStatus, 30_000)
    const tick = setInterval(() => (nowMs = Date.now()), 1000)
    return () => { clearInterval(poll); clearInterval(tick) }
  })

  const STATUS_COLOR = {
    disabled:     'text-text-dim',
    waiting:      'text-warning',
    connecting:   'text-blue-400',
    synchronized: 'text-accent',
    retry:        'text-error',
  }

  let ntpStatus = $derived(ntpData?.ntp_status ?? null)

  // Milliseconds remaining until next event (sync or retry), adjusted for elapsed
  let remainingMs = $derived(
    ntpData?.ntp_next_sync_ms != null
      ? Math.max(0, ntpData.ntp_next_sync_ms - (nowMs - ntpFetchedAt))
      : null
  )

  function fmtAgo(unixTs) {
    if (!unixTs) return null
    const s = Math.max(0, Math.floor(nowMs / 1000) - unixTs)
    if (s < 60)   return `${s}s ago`
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s ago`
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`
  }

  function fmtCountdown(ms) {
    if (ms == null) return '—'
    const s = Math.ceil(ms / 1000)
    if (s <= 0)   return '—'
    if (s < 60)   return `${s}s`
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  }
  // ── end NTP status ───────────────────────────────────────────────────────

  async function setClockNow() {
    if (busy) return
    busy = true
    try {
      const body = JSON.stringify({
        sntp_enabled: false,
        time: new Date().toISOString(),
        time_zone: $config_store?.time_zone,
      })
      const res = await serialQueue.add(() => httpAPI('POST', '/time', body))
      if (!res || res === 'error' || res.msg !== 'done') showWriteError()
    } finally {
      busy = false
    }
  }
</script>

<ConfigPage title={$_('config.pages.time')}>
  <ConfigSection title={$_('config.time.status')}>
    {#if $status_store?.time}
      {@const dt = new Date($status_store.time)}
      <ReadOnlyRow label={$_('config.time.device_date')} value={dt.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} />
      <ReadOnlyRow label={$_('config.time.device_time')} value={dt.toLocaleTimeString()} />
    {:else}
      <ReadOnlyRow label={$_('config.time.device_time')} value={$status_store?.time} />
    {/if}
  </ConfigSection>

  <ConfigSection>
    <FormField label={$_('config.time.source')} status={$ss.sntp_enabled ?? 'idle'}>
      <Select
        options={sourceOptions}
        value={isNtp ? 'ntp' : 'manual'}
        onchange={(v) => form.saveField('sntp_enabled', v === 'ntp')}
      />
    </FormField>

    {#if isNtp}
      <FormField label={$_('config.time.ntp_host')} status={$ss.sntp_hostname ?? 'idle'}>
        <div class="flex flex-col gap-1.5">
          <TextInput
            value={$config_store?.sntp_hostname ?? ''}
            placeholder="pool.ntp.org"
            revert={form.revert}
            onchange={(v) => form.saveField('sntp_hostname', v)}
          />
          {#if shownIp}
            <span class="inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium
              {shownIp === 'failed'
                ? 'bg-error/15 text-error'
                : 'bg-accent/15 text-accent'}">
              {shownIp === 'failed'
                ? $_('config.time.ntp_dns_failed')
                : $_('config.time.ntp_dns_ok') + shownIp}
            </span>
          {/if}
        </div>
      </FormField>
    {:else}
      <FormField label={$_('config.time.set_clock')} description={$_('config.time.set_clock_desc')}>
        <Button label={$_('config.time.set_now')} variant="ghost" disabled={busy} onclick={setClockNow} />
      </FormField>
    {/if}

    <FormField label={$_('config.time.timezone')} status={$ss.time_zone ?? 'idle'}>
      <Select
        options={tzOptions}
        value={$config_store?.time_zone ?? ''}
        onchange={(v) => form.saveField('time_zone', v)}
      />
    </FormField>
  </ConfigSection>

  {#if isNtp && ntpData}
    <ConfigSection title={$_('config.time.ntp_status_title')}>
      <!-- Status row with coloured badge -->
      <div class="flex items-center justify-between gap-3 py-2 text-sm">
        <span class="text-text-dim">{$_('config.time.ntp_status_label')}</span>
        <span class="font-semibold {STATUS_COLOR[ntpStatus] ?? 'text-text'}">
          {$_('config.time.ntp_' + (ntpStatus ?? 'waiting'))}
          {#if ntpStatus === 'synchronized'}✓{/if}
        </span>
      </div>

      <ReadOnlyRow
        label={$_('config.time.ntp_last_sync')}
        value={ntpData.ntp_last_sync ? fmtAgo(ntpData.ntp_last_sync) : $_('config.time.ntp_never')}
      />

      {#if ntpStatus === 'synchronized'}
        <ReadOnlyRow
          label={$_('config.time.ntp_next_sync')}
          value={fmtCountdown(remainingMs)}
        />
        <ReadOnlyRow
          label={$_('config.time.ntp_next_retry')}
          value="{$_('config.time.ntp_synchronized')} ✓"
          tone="ok"
        />
      {:else if ntpStatus === 'retry'}
        <ReadOnlyRow label={$_('config.time.ntp_next_sync')} value="—" />
        <ReadOnlyRow
          label={$_('config.time.ntp_next_retry')}
          value={fmtCountdown(remainingMs)}
          tone="error"
        />
      {:else if ntpStatus === 'connecting'}
        <ReadOnlyRow label={$_('config.time.ntp_next_sync')} value={$_('config.time.ntp_connecting')} />
        <ReadOnlyRow label={$_('config.time.ntp_next_retry')} value="—" />
      {:else}
        <ReadOnlyRow label={$_('config.time.ntp_next_sync')} value="—" />
        <ReadOnlyRow label={$_('config.time.ntp_next_retry')} value="—" />
      {/if}

      <div class="mt-3">
        <Button
          label={syncBusy ? $_('config.time.ntp_syncing') : $_('config.time.ntp_sync_now')}
          disabled={syncBusy}
          onclick={syncNow}
        />
      </div>
    </ConfigSection>
  {/if}
</ConfigPage>
