<script>
  import { _ } from 'svelte-i18n'
  import Icon from '../../icons/Icon.svelte'

  let { path = '/' } = $props()

  const items = [
    { href: '/', key: 'nav.home', icon: 'mdi:home-outline' },
    { href: '/schedule', key: 'nav.schedule', icon: 'mdi:calendar-clock-outline' },
    { href: '/monitoring', key: 'nav.monitoring', icon: 'mdi:chart-line' },
    { href: '/history', key: 'nav.history', icon: 'mdi:history' },
    { href: '/settings', key: 'nav.settings', icon: 'mdi:cog-outline' },
  ]
</script>

<!-- min-h instead of fixed h so the home-indicator inset on iPhone can
     expand the nav downward without shrinking the button row. Side and
     bottom safe-area insets pad the rounded screen corners. The sidebar
     layout on sm+ doesn't need any of this. -->
<nav
  class="flex min-h-14 items-stretch border-t border-border bg-surface-2
         pb-[env(safe-area-inset-bottom)]
         pl-[env(safe-area-inset-left)]
         pr-[env(safe-area-inset-right)]
         sm:h-full sm:min-h-0 sm:w-20 sm:flex-col sm:border-r sm:border-t-0
         sm:pb-0 sm:pl-0 sm:pr-0"
>
  {#each items as item}
    <a
      href="#{item.href}"
      aria-label={$_(item.key)}
      aria-current={path === item.href ? 'page' : undefined}
      class="flex flex-1 flex-col items-center justify-center gap-1 text-[10px]
             sm:flex-none sm:py-4
             {path === item.href ? 'text-accent' : 'text-text-dim'}"
    >
      <Icon icon={item.icon} size={22} />
      <span>{$_(item.key)}</span>
    </a>
  {/each}
</nav>
