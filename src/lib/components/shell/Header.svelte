<script>
  import { _ } from 'svelte-i18n'
  import GearMark from '../../../assets/GearMark.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import { theme } from '../../stores/theme.js'
  let { deviceName = 'OpenEVSE', wsConnected = true, evseConnected = true } = $props()
  let connected = $derived(wsConnected && evseConnected)
  let statusKey = $derived(
    !wsConnected
      ? 'connection.lost'
      : !evseConnected
        ? 'connection.evse_missing'
        : 'connection.connected',
  )
</script>

<!-- pt + horizontal pad respect the iOS notch / status bar so brand and
     connection dot don't disappear behind the clock or the curved edge.
     --safe-top is JS-probed (see lib/safeArea.js) — env() reads 0 on the
     first paint of an iOS standalone PWA. -->
<header
  class="flex items-center justify-between py-3
         pt-[max(var(--safe-top,0px),0.75rem)]
         pl-[max(env(safe-area-inset-left),1rem)]
         pr-[max(env(safe-area-inset-right),1rem)]"
>
  <div class="flex items-center gap-2">
    <GearMark size={26} class="text-accent" />
    <span class="text-sm font-semibold text-text">{deviceName}</span>
  </div>
  <div class="flex items-center gap-2">
    <IconButton
      icon={$theme.resolved === 'dark' ? 'mdi:weather-sunny' : 'mdi:weather-night'}
      label="Toggle theme"
      onclick={() => theme.setTheme($theme.resolved === 'dark' ? 'light' : 'dark')}
    />
    <span
      aria-label={$_(statusKey)}
      title={$_(statusKey)}
      class="h-2.5 w-2.5 rounded-full {connected ? 'bg-accent' : 'bg-error'}"
    ></span>
  </div>
</header>
