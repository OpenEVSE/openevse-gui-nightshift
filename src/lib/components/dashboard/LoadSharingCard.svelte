<script>
  // Home-page load sharing: one grey line while nothing is limited, a card
  // with a bar and one reason when it is, red when the reason is a lost
  // controller. The full breakdown lives on Settings → Load sharing; this is
  // the glance, not the feature.
  import { _ } from 'svelte-i18n'
  import { formatDuration } from '../../format/duration.js'

  /** @type {{ view: import('../../dashboard/loadsharing.js').loadSharingView extends (...a: any) => infer R ? NonNullable<R> : never }} */
  let { view } = $props()

  let fillPct = $derived(
    view.limit !== null && view.localMax > 0 ? Math.max(0, Math.min(100, (view.limit / view.localMax) * 100)) : 0,
  )
  let controllerUrl = $derived(view.controller ? `http://${view.controller}` : '')

  let pillKey = $derived(
    view.state === 'failsafe'
      ? 'dashboard.loadsharing.pill_failsafe'
      : view.role === 'controller'
        ? 'dashboard.loadsharing.pill_controller_limited'
        : 'dashboard.loadsharing.pill_member_limited',
  )
</script>

{#if view.state === 'sharing'}
  <p class="mt-2 text-center text-[10px] text-text-dim">
    {#if view.role === 'member'}
      {$_('dashboard.loadsharing.line_member', {
        values: { controller: view.controller || $_('config.loadsharing.unknown'), amps: view.pilot, max: view.localMax },
      })}
    {:else if view.others}
      {$_('dashboard.loadsharing.line_controller', {
        values: { count: view.others, total: view.groupTotal ?? view.pilot, max: view.groupMax ?? view.localMax },
      })}
    {:else}
      <!-- A group of one (nobody has joined yet): no count to report. -->
      {$_('dashboard.loadsharing.line_alone', {
        values: { total: view.groupTotal ?? view.pilot, max: view.groupMax ?? view.localMax },
      })}
    {/if}
  </p>
{:else}
  <div
    role="status"
    class="mt-2 rounded-xl border px-3 py-2 {view.state === 'failsafe' ? 'border-error/40 bg-error/5' : 'border-border bg-surface-2'}"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="text-[10px] font-semibold tracking-wide text-text-dim uppercase">{$_('dashboard.loadsharing.title')}</span>
      <span
        class="rounded-full px-2 py-0.5 text-[10px] font-semibold {view.state === 'failsafe'
          ? 'bg-error/15 text-error'
          : 'bg-warning/15 text-warning'}"
      >
        {$_(pillKey)}
      </span>
    </div>

    <!-- Same language as the SOC bar below: a track, a fill to the cap, one label. -->
    <div class="mt-2 flex items-center gap-2">
      <div class="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
        <div
          class="absolute inset-y-0 left-0 rounded-full {view.state === 'failsafe' ? 'bg-error' : 'bg-warning'}"
          style="width: {fillPct}%"
        ></div>
      </div>
      <span class="shrink-0 text-xs font-semibold text-text">
        {$_('dashboard.loadsharing.bar', { values: { limit: view.limit ?? view.pilot, max: view.localMax } })}
      </span>
    </div>

    {#if view.state === 'failsafe'}
      <!-- One sentence, once, and true: the host as a link, then how long it
           has been gone and what the charger fell back to. A member cannot
           change load-sharing settings (the firmware rejects them as
           read-only) and there is no leave/retry endpoint yet, so the only
           honest exit is the settings page that explains the group. -->
      <p class="mt-2 text-xs text-error">
        {#if controllerUrl}
          <a class="font-semibold underline" href={controllerUrl} target="_blank" rel="noopener">{view.controller}</a>
        {:else}
          <span class="font-semibold">{$_('config.loadsharing.unknown')}</span>
        {/if}
        {#if view.unreachableFor !== null}
          {$_('dashboard.loadsharing.failsafe_for', {
            values: { duration: formatDuration(view.unreachableFor), limit: view.safeLimit ?? view.limit ?? view.pilot },
          })}
        {:else}
          {$_('dashboard.loadsharing.failsafe_never', {
            values: { limit: view.safeLimit ?? view.limit ?? view.pilot },
          })}
        {/if}
      </p>
      <p class="mt-1 text-right text-[10px]">
        <a class="text-text-dim underline hover:text-text" href="#/settings/loadsharing">
          {$_('dashboard.loadsharing.settings')}
        </a>
      </p>
    {:else}
      <p class="mt-2 text-xs text-warning">
        {#if view.groupTotal !== null && view.groupMax !== null}
          {$_('dashboard.loadsharing.limited_group', { values: { limit: view.limit, total: view.groupTotal, max: view.groupMax } })}
        {:else}
          {$_('dashboard.loadsharing.limited', { values: { limit: view.limit } })}
        {/if}
      </p>
    {/if}
  </div>
{/if}
