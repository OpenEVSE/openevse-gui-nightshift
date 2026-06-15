<script>
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import Slider from '../ui/Slider.svelte'
  import Toggle from '../ui/Toggle.svelte'

  let {
    active      = true,
    current     = 32,
    minCurrent  = 6,
    maxCurrent  = 32,
    busy        = false,
    onchange        = () => {},   // (active: boolean) => void
    onCurrentChange = () => {},   // (amps: number) => void
  } = $props()
</script>

<Card class="mb-3 p-4">
  <!-- Active / Disabled row -->
  <div class="flex items-center justify-between gap-3">
    <div class="min-w-0 flex-1">
      <div class="text-sm font-semibold text-text">{$_('charge_manager.default_state')}</div>
      <div class="mt-0.5 text-xs text-text-dim">
        {active ? $_('charge_manager.default_state_active') : $_('charge_manager.default_state_disabled')}
      </div>
    </div>
    <Toggle
      checked={active}
      label={$_('charge_manager.default_state')}
      disabled={busy}
      {onchange}
    />
  </div>

  <!-- Current slider -->
  <div class="mt-4">
    <div class="mb-1 flex items-baseline justify-between text-[10px] uppercase tracking-wide text-text-dim">
      <span>{$_('charge_manager.feature_charge_current')}</span>
      <span class="font-semibold normal-case text-text">{current} A</span>
    </div>
    <Slider
      min={minCurrent}
      max={maxCurrent}
      step={1}
      value={current}
      disabled={busy}
      format={(v) => `${v} A`}
      ariaLabel={$_('charge_manager.feature_charge_current')}
      onchange={onCurrentChange}
    />
    <div class="mt-1 flex justify-between text-[10px] text-text-dim">
      <span>{minCurrent} A</span>
      <span>{maxCurrent} A</span>
    </div>
  </div>
</Card>
