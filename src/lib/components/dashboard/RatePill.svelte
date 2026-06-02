<script>
  import { _ } from 'svelte-i18n'
  import Popover from '../ui/Popover.svelte'
  import Slider from '../ui/Slider.svelte'

  let { amps = 6, min = 6, max = 48, claimedBy = '', disabled = false, onchange = () => {} } = $props()

  let open = $state(false)

  function toggle() {
    if (disabled) return
    open = !open
  }
</script>

<div class="relative inline-block text-center">
  <button
    type="button"
    aria-label={$_('dashboard.rate.aria')}
    {disabled}
    onclick={toggle}
    class="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[13px] font-bold text-text
           disabled:cursor-not-allowed"
    class:opacity-40={disabled}
  >
    <span>{amps} A</span> <span aria-hidden="true">▾</span>
  </button>

  <Popover {open} align="right" onclose={() => (open = false)}>
    <div class="w-56 rounded-xl border border-border bg-surface-2 p-3 shadow-xl">
      <div class="mb-1 text-sm font-bold text-accent">{amps} A</div>
      <Slider {min} {max} step={1} value={amps} ariaLabel={$_('dashboard.rate.aria')} {onchange} />
      {#if claimedBy}
        <div class="mt-1 text-[9px] text-text-dim">
          {$_('dashboard.rate.claimed', { values: { client: claimedBy } })}
        </div>
      {/if}
    </div>
  </Popover>
</div>
