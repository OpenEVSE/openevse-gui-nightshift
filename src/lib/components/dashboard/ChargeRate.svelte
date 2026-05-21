<script>
  import { _ } from 'svelte-i18n'
  import Slider from '../ui/Slider.svelte'

  let { amps = 6, min = 6, max = 48, disabled = false, claimedBy = '', onchange = () => {} } = $props()
</script>

<div class="pt-3">
  <div class="mb-2 flex items-center justify-between text-[11px]">
    <span class="text-text-dim uppercase tracking-wide">{$_('dashboard.rate.label')}</span>
    <span class="font-bold text-accent">{amps} A</span>
  </div>
  <Slider {min} {max} step={1} value={amps} {disabled} {onchange} />
  {#if claimedBy}
    <div class="mt-1 text-[9px] text-text-dim">
      {$_('dashboard.rate.claimed', { values: { client: claimedBy } })}
    </div>
  {/if}
</div>
