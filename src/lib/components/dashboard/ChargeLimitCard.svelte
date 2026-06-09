<script>
  import { _ } from 'svelte-i18n'
  import Icon from '../../icons/Icon.svelte'
  import VehicleSocBar from './VehicleSocBar.svelte'

  let {
    // bar inputs
    hasSoc = false,
    soc = 0,
    vehicleLimit = null,
    target = 80,
    range = null,
    rangeMiles = false,
    timeToFull = 0,
    charging = false,
    unit = 'percent',
    estMaxRange = null,
    disabled = false,
    ontarget = () => {},
    onunit = () => {},
    // time/energy limit row
    limit = { type: 'none' },
    summary = '',
    onopen = () => {},
    onclear = () => {},
    // false for a system (default) limit — it shows but can't be cleared here.
    clearable = true,
  } = $props()

  // The compact row reflects only the non-bar limit kinds (time/energy).
  let rowActive = $derived(limit && (limit.type === 'time' || limit.type === 'energy'))
  // Without a vehicle the row is the only limit control, so label it plainly.
  let rowLabelKey = $derived(hasSoc ? 'dashboard.limit.or_limit_by' : 'dashboard.limit.label')
</script>

<div class="mt-3 rounded-xl bg-surface-2 px-3 py-3">
  {#if hasSoc}
    <VehicleSocBar
      {soc}
      {vehicleLimit}
      {target}
      {range}
      {rangeMiles}
      {timeToFull}
      {charging}
      {unit}
      {estMaxRange}
      {disabled}
      onchange={ontarget}
      {onunit}
    />
    <div class="my-3 border-t border-border"></div>
  {/if}

  <div class="flex items-center justify-between">
    <div>
      <div class="text-[8px] tracking-wide text-text-dim uppercase">{$_(rowLabelKey)}</div>
      <div class="mt-0.5 text-sm font-bold text-text">
        {rowActive ? summary : $_('dashboard.limit.none')}
      </div>
    </div>
    {#if rowActive}
      {#if clearable}
        <button
          type="button"
          aria-label={$_('dashboard.limit.clear')}
          onclick={onclear}
          class="rounded-full p-1 text-text-dim hover:text-error"
        >
          <Icon icon="mdi:close" size={18} />
        </button>
      {/if}
    {:else}
      <button type="button" onclick={onopen} class="text-xs font-semibold text-accent">
        + <span>{$_('dashboard.limit.set')}</span>
      </button>
    {/if}
  </div>
</div>
