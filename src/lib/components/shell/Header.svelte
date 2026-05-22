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

<header class="flex items-center justify-between px-4 py-3">
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
