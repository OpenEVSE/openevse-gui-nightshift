<!-- src/lib/components/notifications/AdvisoryStrip.svelte -->
<script>
  // The status page's strip for critical advisories.
  //
  // Only criticals reach here, and only unmuted ones: this is the loudest
  // thing the feature does short of the fault screen, so it has to be right
  // every time it appears or the owner learns to scroll past it.
  import { _ } from 'svelte-i18n'
  import { notification_store } from '../../stores/notifications.js'
  import { criticalItems, advisoryRoute, isKnownAdvisory } from '../../notifications/notifications.js'

  let items = $derived(criticalItems($notification_store.items))

  // Dismissal is per-set, not for the session: hiding the strip hides *these*
  // advisories, and a new critical brings it straight back. Tying it to the
  // set is what stops a dismissal from silently swallowing the next one.
  // Not persisted — a reload is a fair moment to be shown a critical again,
  // and the panel and the settings marker carry it in the meantime either way.
  let dismissedKey = $state('')
  let key = $derived(items.map((n) => n.id).join(','))
  let visible = $derived(items.length > 0 && dismissedKey !== key)

  function title(id) {
    return isKnownAdvisory(id) ? $_('notifications.title.' + id) : id
  }
</script>

{#if visible}
  <div role="alert" class="mb-3 rounded-2xl border border-error/40 bg-error/10 p-3">
    <div class="flex items-start justify-between gap-3">
      <p class="text-sm font-semibold text-error">{$_('notifications.strip_title')}</p>
      <button
        type="button"
        onclick={() => (dismissedKey = key)}
        class="shrink-0 text-xs font-semibold text-text-dim hover:text-text"
      >
        {$_('notifications.strip_dismiss')}
      </button>
    </div>
    <ul class="mt-1.5 flex flex-col gap-1">
      {#each items as item (item.id)}
        {@const route = advisoryRoute(item.id)}
        <li class="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-text">
          <span class="min-w-0">{title(item.id)}</span>
          {#if route}
            <a href="#{route}" class="text-xs font-semibold text-accent hover:underline">
              {$_('notifications.strip_action')}
            </a>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
{/if}
