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

<!-- Total height = 56px button row + the home-indicator inset, with
     padding-bottom reserving exactly the inset so the buttons still
     get their full 56px. Without growing the height first, border-box
     would shrink the button area instead of pushing the bar taller.
     The sidebar layout on sm+ resets everything.

     --safe-bottom is written by lib/safeArea.js (JS probe of env()).
     iOS standalone PWA returns 0 for env(safe-area-inset-bottom) on
     the first paint and only resolves it after a reflow; the probe
     keeps the variable in sync. -->
<nav
  class="flex h-[calc(3.5rem+var(--safe-bottom,0px))] items-stretch border-t border-border bg-surface-2
         pb-[var(--safe-bottom,0px)]
         pl-[env(safe-area-inset-left)]
         pr-[env(safe-area-inset-right)]
         sm:h-full sm:w-20 sm:flex-col sm:border-r sm:border-t-0
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
