<!-- src/lib/components/notifications/NotificationBell.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import IconButton from '../ui/IconButton.svelte'
  import NotificationPanel from './NotificationPanel.svelte'
  import { notification_store } from '../../stores/notifications.js'

  let open = $state(false)

  // The badge number is the firmware's own `count`, which excludes muted
  // entries — the same figure that drives the LCD's amber border, so the two
  // can never disagree.
  let count = $derived($notification_store.count)
  let severity = $derived($notification_store.severity)

  // The bell appears when the charger has anything to show, muted entries
  // included: a muted advisory counts for nothing on the badge but must stay
  // reachable. A charger with a clean bill of health grows no dead control —
  // and a build with no advisory engine never fills the store at all, so this
  // is also the capability gate reaching the header.
  let show = $derived(($notification_store.items ?? []).length > 0)

  // Red only for critical; amber for everything else that is still counted.
  let badgeTone = $derived(severity === 'critical' ? 'bg-error' : 'bg-warning')
</script>

{#if show}
  <div class="relative">
    <IconButton
      icon="mdi:bell-outline"
      label={$_('notifications.bell', { values: { count } })}
      onclick={() => (open = true)}
    />
    {#if count > 0}
      <!-- aria-hidden: the count is already in the button's own label, so
           announcing the digits again would just repeat it. -->
      <span
        aria-hidden="true"
        class="pointer-events-none absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center
               rounded-full px-1 text-[10px] font-bold text-surface {badgeTone}"
      >
        {count}
      </span>
    {/if}
  </div>

  <NotificationPanel visible={open} onclose={() => (open = false)} />
{/if}
