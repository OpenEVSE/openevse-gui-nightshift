<script>
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import Icon from '../../icons/Icon.svelte'

  let {
    stateIcon, stateTone = 'muted', stateDesc = '',
    typeIcon, typeTone = 'muted', typeLabel = '',
    timeText = '', energyKwh = 0,
    temp = 0, tempUnit = 'units.celsius',
  } = $props()

  const toneClass = {
    info: 'text-accent',
    ok: 'text-accent',
    charging: 'text-warning',
    error: 'text-error',
    muted: 'text-text-dim',
  }
</script>

<Card class="flex items-center gap-3 p-3">
  <Icon icon={stateIcon} size={24} class={toneClass[stateTone]} />
  <div class="min-w-0 flex-1">
    <div class="truncate text-sm font-semibold text-text">{stateDesc}</div>
    <div class="mt-0.5 flex items-center gap-1.5 text-xs text-text-dim">
      <Icon icon={typeIcon} size={13} class={toneClass[typeTone]} />
      <span>{typeLabel}</span>
      <span aria-hidden="true">·</span>
      <span>{timeText}</span>
    </div>
  </div>
  <div class="shrink-0 text-right">
    <div class="text-sm font-bold text-text">
      {energyKwh.toFixed(1)}<span class="ml-1 text-xs font-normal text-text-dim">kWh</span>
    </div>
    <div class="text-xs text-text-dim">{temp == null ? '—' : Number(temp).toFixed(1)} {$_(tempUnit)}</div>
  </div>
</Card>
