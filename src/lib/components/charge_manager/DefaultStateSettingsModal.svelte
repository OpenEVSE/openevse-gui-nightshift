<script>
  import { _ } from 'svelte-i18n'
  import Modal from '../ui/Modal.svelte'
  import Button from '../ui/Button.svelte'
  import Toggle from '../ui/Toggle.svelte'
  import Slider from '../ui/Slider.svelte'
  import NumberInput from '../ui/NumberInput.svelte'

  let {
    open    = false,
    busy    = false,
    // Default state on power-up
    active  = true,
    // Heartbeat supervision (only when firmware exposes it)
    heartbeatSupported = false,
    heartbeatEnabled   = false,
    heartbeatInterval  = 5,
    heartbeatCurrent   = 6,
    maxCurrent         = 32,
    // Boot lock (only when firmware exposes it)
    bootLockSupported  = false,
    bootLock           = false,
    onDefaultStateChange = () => {},  // (active: boolean) => void
    onHeartbeatChange    = () => {},  // (enabled: boolean) => void
    onHeartbeatInterval  = () => {},  // (seconds: number) => void
    onHeartbeatCurrent   = () => {},  // (amps: number) => void
    onBootLockChange     = () => {},  // (enabled: boolean) => void
    onclose = () => {},
  } = $props()

  // Missing-heartbeat fail current tops out at half the hardware maximum.
  let heartbeatMax = $derived(Math.max(6, Math.floor((maxCurrent ?? 12) / 2)))
</script>

<Modal visible={open} closable={!busy} {onclose}>
  <h2 class="mb-5 text-base font-semibold text-text">{$_('charge_manager.default_state_settings')}</h2>

  <!-- Default state on power-up -->
  <div class="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
    <div class="min-w-0">
      <div class="text-sm font-semibold text-text">{$_('charge_manager.default_state')}</div>
      <div class="mt-0.5 text-xs text-text-dim">
        {active ? $_('charge_manager.default_state_active') : $_('charge_manager.default_state_disabled')}
      </div>
    </div>
    <Toggle
      checked={active}
      label={$_('charge_manager.default_state')}
      disabled={busy}
      onchange={onDefaultStateChange}
    />
  </div>

  {#if heartbeatSupported}
    <div class="mt-3 rounded-xl border border-border bg-surface p-3">
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm font-semibold text-text">{$_('config.security.heartbeat')}</span>
        <Toggle
          checked={heartbeatEnabled}
          label={$_('config.security.heartbeat')}
          disabled={busy}
          onchange={onHeartbeatChange}
        />
      </div>
      {#if heartbeatEnabled}
        <div class="mt-3 flex items-center justify-between gap-3">
          <span class="text-xs text-text-dim">{$_('config.security.heartbeat_interval')}</span>
          <NumberInput
            value={heartbeatInterval}
            min={1}
            max={60}
            disabled={busy}
            onchange={onHeartbeatInterval}
          />
        </div>
        <div class="mt-3 mb-1 flex items-baseline justify-between text-[10px] uppercase tracking-wide text-text-dim">
          <span>{$_('config.security.heartbeat_current')}</span>
          <span class="font-semibold normal-case text-text">{heartbeatCurrent} A</span>
        </div>
        <Slider
          min={6}
          max={heartbeatMax}
          step={1}
          value={heartbeatCurrent}
          disabled={busy}
          format={(v) => `${v} A`}
          ariaLabel={$_('config.security.heartbeat_current')}
          onchange={onHeartbeatCurrent}
        />
        <div class="mt-1 flex justify-between text-[10px] text-text-dim">
          <span>6 A</span>
          <span>{heartbeatMax} A</span>
        </div>
      {/if}
    </div>
  {/if}

  {#if bootLockSupported}
    <div class="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
      <span class="text-sm font-semibold text-text">{$_('config.security.boot_lock')}</span>
      <Toggle
        checked={bootLock}
        label={$_('config.security.boot_lock')}
        disabled={busy}
        onchange={onBootLockChange}
      />
    </div>
  {/if}

  <div class="mt-6 flex">
    <Button label={$_('charge_manager.rule_cancel')} variant="ghost" disabled={busy} onclick={onclose} />
  </div>
</Modal>
