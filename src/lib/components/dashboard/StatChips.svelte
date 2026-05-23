<script>
  import { _ } from 'svelte-i18n'
  import StatChip from '../ui/StatChip.svelte'

  let { charging = false, live = {}, summary = {} } = $props()
</script>

<!-- Fixed-height band: the charging layout (chips + sensor row) is taller
     than the resting summary, so reserve its height and centre the content.
     This keeps the controls below from shifting as the state changes. -->
<div class="flex min-h-[96px] flex-col justify-center">
  {#if charging}
    <div class="grid grid-cols-3 gap-2 py-2">
      <StatChip value={live.sessionKwh} label={$_('dashboard.chips.session')} />
      <StatChip value={live.elapsed} label={$_('dashboard.chips.elapsed')} />
      <StatChip value={`${live.currentA} A`} label={$_('dashboard.chips.current')} />
    </div>
    <div class="flex justify-around border-b border-border pb-2 text-[9px] text-text-dim">
      <span>{$_('dashboard.chips.voltage')} <b class="text-text">{live.voltage} V</b></span>
      <span>{$_('dashboard.chips.temp')} <b class="text-text">{live.temp}{$_(live.tempUnit)}</b></span>
      <span>{$_('dashboard.chips.pilot')} <b class="text-text">{live.pilotA} A</b></span>
    </div>
  {:else}
    <div class="flex justify-center gap-6 rounded-xl bg-surface-2 py-2 text-[10px] text-text-dim">
      <span>{$_('dashboard.summary.today')} <b class="text-text"><span>{summary.todayKwh}</span> kWh</b></span>
      <span>{$_('dashboard.summary.total')} <b class="text-text"><span>{summary.totalKwh}</span> kWh</b></span>
    </div>
  {/if}
</div>
