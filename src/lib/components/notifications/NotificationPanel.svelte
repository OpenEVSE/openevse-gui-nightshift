<!-- src/lib/components/notifications/NotificationPanel.svelte -->
<script>
  // The advisory list: everything the charger is currently reporting, newest
  // first, muted entries included and marked as such.
  //
  // This panel is the index, not the feature. A list of complaints the reader
  // then has to go hunting for is a worse version of the event log they
  // already have — so every row carries a link to the control or the page that
  // acts on it.
  import { _ } from 'svelte-i18n'
  import Modal from '../ui/Modal.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import { notification_store } from '../../stores/notifications.js'
  import { sortNewestFirst, advisoryRoute, isKnownAdvisory } from '../../notifications/notifications.js'
  import { formatAgo } from '../../format/duration.js'
  import { serialQueue } from '../../queue.js'
  import { showWriteError } from '../../alerts.js'

  let { visible = false, onclose = () => {} } = $props()

  let rows = $derived(sortNewestFirst($notification_store.items))
  let busyId = $state('')

  // Amber for warning, red only for critical (the fault screen owns red).
  const TONE = {
    critical: 'bg-error/15 text-error',
    warning: 'bg-warning/15 text-warning',
    info: 'bg-surface-3 text-text-dim',
  }
  const ROUTE_LABEL = {
    '/settings/safety': 'notifications.link.safety',
    '/monitoring/health': 'notifications.link.health',
  }

  // Ids are stable and locale-independent; all display text is ours. A
  // firmware that adds one ships an id this build has no copy for, so fall
  // back to the raw id rather than a missing-key placeholder.
  function title(id) {
    return isKnownAdvisory(id) ? $_('notifications.title.' + id) : id
  }
  function detail(id) {
    return isKnownAdvisory(id) ? $_('notifications.detail.' + id) : ''
  }

  function raisedLabel(item) {
    // first_seen is null when the clock had not synced at the moment the
    // charger recorded this — unknown, never 1970.
    const ago = formatAgo(item.first_seen)
    return ago ? $_('notifications.raised', { values: { ago } }) : $_('notifications.time_unknown')
  }

  async function ack(id) {
    if (busyId) return
    busyId = id
    try {
      const ok = await serialQueue.add(() => notification_store.ack(id))
      // A 404 means the advisory cleared between render and tap. ack()
      // re-reads the list either way, so if it is gone the UI has already
      // corrected itself and there is nothing worth alerting about.
      if (!ok && $notification_store.items.some((n) => n.id === id)) {
        showWriteError()
      }
    } finally {
      busyId = ''
    }
  }
</script>

<Modal {visible} size="md" {onclose}>
  <div class="flex items-start justify-between gap-3">
    <h2 class="text-base font-semibold text-text">{$_('notifications.title_panel')}</h2>
    <IconButton icon="mdi:close" label={$_('notifications.close')} onclick={onclose} />
  </div>

  {#if rows.length === 0}
    <p class="py-6 text-center text-sm text-text-dim">{$_('notifications.empty')}</p>
  {:else}
    <div class="mt-3 flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
      {#each rows as item (item.id)}
        {@const route = advisoryRoute(item.id)}
        <div class="rounded-xl border border-border p-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-text">{title(item.id)}</p>
              {#if detail(item.id)}
                <p class="mt-0.5 text-xs text-text-dim">{detail(item.id)}</p>
              {/if}
            </div>
            <span class="flex shrink-0 items-center gap-1.5">
              <span
                class="rounded px-2 py-0.5 text-xs font-semibold {TONE[item.severity] ?? TONE.info}"
              >
                {$_('notifications.severity.' + item.severity)}
              </span>
              {#if item.acked}
                <span class="rounded bg-surface-3 px-2 py-0.5 text-xs text-text-dim">
                  {$_('notifications.muted')}
                </span>
              {/if}
            </span>
          </div>

          <div class="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span class="text-xs text-text-dim">{raisedLabel(item)}</span>
            <span class="flex items-center gap-4">
              {#if route}
                <a
                  href="#{route}"
                  onclick={onclose}
                  class="text-xs font-semibold text-accent hover:underline"
                >
                  {$_(ROUTE_LABEL[route] ?? 'notifications.link.health')}
                </a>
              {/if}
              {#if !item.acked}
                <!-- Two different words for one endpoint, because they are two
                     different promises. A sticky advisory (the safety checks,
                     thermal, drift) is muted: it stays listed and keeps its
                     marker beside the switch. Everything else is dismissed
                     until the underlying counter moves again. -->
                <button
                  type="button"
                  disabled={!!busyId}
                  onclick={() => ack(item.id)}
                  class="text-xs font-semibold text-text-dim hover:text-text disabled:opacity-40"
                >
                  {item.sticky ? $_('notifications.mute') : $_('notifications.dismiss')}
                </button>
              {/if}
            </span>
          </div>
        </div>
      {/each}
    </div>
    <p class="mt-3 text-xs text-text-dim">{$_('notifications.mute_note')}</p>
  {/if}
</Modal>
