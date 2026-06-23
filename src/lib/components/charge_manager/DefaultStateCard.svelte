<script>
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import Slider from '../ui/Slider.svelte'
  import IconButton from '../ui/IconButton.svelte'
  import Icon from '../../icons/Icon.svelte'

  import { untrack } from 'svelte'

  let {
    current     = 32,
    minCurrent  = 6,
    maxCurrent  = 32,
    busy        = false,
    // Status indicators (the switches themselves live in the settings page).
    heartbeatSupported = false,
    heartbeatActive    = false,   // red heart when heartbeat supervision is on
    heartbeatInterval  = 5,       // seconds (for the heart hover tooltip)
    heartbeatCurrent   = 6,       // A (fail current, for the hover tooltip)
    bootLock           = false,   // lock icon shown only when boot lock is on
    onCurrentChange = () => {},   // (amps: number) => void
    onEdit          = () => {},   // open the settings page
  } = $props()

  // Live value shown large above the slider — tracks the thumb while dragging.
  let liveCurrent = $state(untrack(() => current))
  $effect(() => { liveCurrent = current })
</script>

<Card class="mb-3 p-4">
  <!-- Header: title · status icons (heart / lock) · edit pencil -->
  <div class="flex items-center justify-between gap-3">
    <div class="text-sm font-semibold text-text">{$_('charge_manager.station')}</div>
    <div class="flex items-center gap-2">
      {#if heartbeatSupported}
        <div class="group relative">
          <span
            role="img"
            aria-label={$_('config.security.heartbeat')}
            class="block {heartbeatActive ? 'text-error' : 'text-text-dim'}"
          >
            <Icon icon={heartbeatActive ? 'mdi:heart' : 'mdi:heart-outline'} size={18} />
          </span>
          {#if heartbeatActive}
            <!-- Hover bubble: heartbeat interval + fail current -->
            <div
              class="pointer-events-none absolute right-0 top-full z-20 mt-1 hidden w-max max-w-[15rem]
                     rounded-md bg-surface-3 px-2 py-1 text-[11px] font-medium text-text shadow-md
                     ring-1 ring-border group-hover:block"
            >
              {$_('config.security.heartbeat_tooltip', {
                values: { interval: heartbeatInterval, current: heartbeatCurrent },
              })}
            </div>
          {/if}
        </div>
      {/if}
      {#if bootLock}
        <span role="img" aria-label={$_('config.security.boot_lock')} class="text-text-dim">
          <Icon icon="mdi:lock" size={18} />
        </span>
      {/if}
      <IconButton
        icon="mdi:pencil-outline"
        size={18}
        label={$_('charge_manager.default_state_settings')}
        disabled={busy}
        onclick={onEdit}
      />
    </div>
  </div>

  <!-- Current — large live set point, no popup, tight to the slider -->
  <div class="mt-3">
    <div class="text-[10px] uppercase tracking-wide text-text-dim">{$_('charge_manager.current')}</div>
    <div class="text-3xl font-bold leading-tight tabular-nums text-text">
      {liveCurrent}<span class="ml-1 text-xl font-semibold text-text-dim">A</span>
    </div>
    <Slider
      min={minCurrent}
      max={maxCurrent}
      step={1}
      value={current}
      disabled={busy}
      showBubble={false}
      ariaLabel={$_('charge_manager.current')}
      oninput={(v) => (liveCurrent = v)}
      onchange={onCurrentChange}
    />
    <div class="mt-1 flex justify-between text-[10px] text-text-dim">
      <span>{minCurrent} A</span>
      <span>{maxCurrent} A</span>
    </div>
  </div>
</Card>
