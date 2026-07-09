<script>
  import { _ } from 'svelte-i18n'
  import Icon from '../../icons/Icon.svelte'
  import GearMark from '../../../assets/GearMark.svelte'

  let { path = '/', deviceName = 'OpenEVSE' } = $props()

  const items = [
    { href: '/', key: 'nav.home', icon: 'mdi:home-outline' },
    { href: '/schedule', key: 'nav.charge_manager', icon: 'mdi:lightning-bolt-circle' },
    { href: '/monitoring', key: 'nav.monitoring', icon: 'mdi:chart-line' },
    { href: '/history', key: 'nav.history', icon: 'mdi:history' },
    { href: '/settings', key: 'nav.settings', icon: 'mdi:cog-outline' },
  ]

  // Highlight the parent tab while inside its sub-routes (e.g. /settings
  // *and* /settings/firmware both light up the Settings tab). The Home
  // item is the special case — '/'.startsWith('/') is true for everything,
  // so it gets a strict equality check.
  function isActive(item, p) {
    if (item.href === '/') return p === '/'
    return p === item.href || p.startsWith(item.href + '/')
  }
</script>

<!-- Total height = 56px button row + the home-indicator inset, with
     padding-bottom reserving exactly the inset so the buttons still
     get their full 56px. Without growing the height first, border-box
     would shrink the button area instead of pushing the bar taller.
     The sidebar layout on sm+ resets everything. -->
<nav
  class="flex h-[calc(3.5rem+env(safe-area-inset-bottom))] items-stretch border-t border-border bg-surface-2
         pb-[env(safe-area-inset-bottom)]
         pl-[env(safe-area-inset-left)]
         pr-[env(safe-area-inset-right)]
         sm:h-full sm:w-24 sm:flex-col sm:border-r sm:border-t-0
         sm:pb-0 sm:pl-0 sm:pr-0
         lg:w-52"
>
  <!-- Desktop rail brand: lives in the sidebar at lg (the header hides its
       copy there); a rule + breathing room separates it from the nav items. -->
  <div class="mb-2 hidden items-center gap-2 border-b border-border px-5 pt-5 pb-4 lg:flex">
    <GearMark size={26} class="text-accent" />
    <span class="text-sm font-semibold text-text">{deviceName}</span>
  </div>
  {#each items as item}
    <a
      href="#{item.href}"
      aria-label={$_(item.key)}
      aria-current={isActive(item, path) ? 'page' : undefined}
      class="flex flex-1 flex-col items-center justify-center gap-1 text-[10px]
             sm:flex-none sm:py-4
             lg:flex-row lg:justify-start lg:gap-3 lg:px-5 lg:py-3 lg:text-sm
             {isActive(item, path) ? 'text-accent' : 'text-text-dim'}"
    >
      <Icon icon={item.icon} size={22} />
      <!-- Only the tablet rail (sm..lg) reserves label height: it is widened
           (w-24) so English/most labels fit on one line, but a long translation
           like fr "Gestionnaire de charge" still wraps to two lines, so every
           item reserves two lines to keep a wrap from knocking its icon off the
           shared baseline. Scoped to sm:max-lg so mobile (short bottom bar) and
           lg (icon-beside-text row) keep their natural single-line flow. -->
      <span
        class="sm:max-lg:flex sm:max-lg:h-[26px] sm:max-lg:items-start sm:max-lg:justify-center
               sm:max-lg:overflow-hidden sm:max-lg:text-center sm:max-lg:leading-tight"
        >{$_(item.key)}</span
      >
    </a>
  {/each}
</nav>
