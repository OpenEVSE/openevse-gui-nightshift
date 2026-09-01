<script>
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import Icon from '../../icons/Icon.svelte'

  let {
    stateIcon, stateTone = 'muted', stateDesc = '',
    typeIcon, typeTone = 'muted', typeLabel = '',
    timeText = '', energyKwh = 0,
    temp = 0, tempUnit = 'units.celsius',
    costText = null,
    userText = null,
    pilotAmps = null,
    reasonText = null,
    periodic = false,
    periodicLabel = '',
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
  <!-- A periodic sample is identical on the left to the row above by
       construction, so its state icon/label are muted; the right-hand numbers
       (which did move) stay at normal weight. -->
  <Icon icon={stateIcon} size={24} class={periodic ? toneClass.muted : toneClass[stateTone]} />
  <div class="min-w-0 flex-1">
    <div class="truncate text-sm font-semibold {periodic ? 'text-text-dim' : 'text-text'}">{stateDesc}</div>
    <div class="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-text-dim">
      <Icon icon={typeIcon} size={13} class={toneClass[typeTone]} />
      <span>{typeLabel}</span>
      <span aria-hidden="true">·</span>
      <span>{timeText}</span>
      {#if userText}
        <span aria-hidden="true">·</span>
        <span class="truncate">{userText}</span>
      {/if}
    </div>
    {#if periodic}
      <!-- Glyph rather than the word "periodic"; nothing visible changed, so a
           muted clock reads as "still going" without restating the state. -->
      <span class="mt-0.5 inline-flex text-text-dim" aria-label={periodicLabel} title={periodicLabel}>
        <Icon icon="mdi:clock-outline" size={14} />
      </span>
    {:else if reasonText}
      <div class="mt-0.5 truncate text-xs text-text">{reasonText}</div>
    {/if}
  </div>
  <div class="shrink-0 text-right">
    <div class="text-sm font-bold text-text">
      {energyKwh.toFixed(1)}<span class="ml-1 text-xs font-normal text-text-dim">kWh</span>
    </div>
    {#if costText}
      <div class="text-xs text-accent">{costText}</div>
    {/if}
    <div class="text-xs text-text-dim">{temp == null ? '—' : Number(temp).toFixed(1)} {$_(tempUnit)}</div>
    {#if pilotAmps != null}
      <div class="text-xs text-text-dim">{pilotAmps} A</div>
    {/if}
  </div>
</Card>
