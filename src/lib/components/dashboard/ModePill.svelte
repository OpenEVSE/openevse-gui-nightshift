<script>
  import { _ } from 'svelte-i18n'
  import Popover from '../ui/Popover.svelte'

  let { mode = 0, locked = false, lockLabel = '', disabled = false, onmode = () => {} } = $props()

  const MODES = [
    { value: 0, key: 'dashboard.mode.auto' },
    { value: 1, key: 'dashboard.mode.on' },
    { value: 2, key: 'dashboard.mode.off' },
  ]

  let open = $state(false)
  let currentKey = $derived((MODES[mode] ?? MODES[0]).key)

  function toggle() {
    if (disabled || locked) return
    open = !open
  }
  function pick(v) {
    open = false
    if (v !== mode) onmode(v)
  }
</script>

<div class="relative inline-block text-center">
  <button
    type="button"
    aria-label={$_('dashboard.mode.aria')}
    disabled={disabled || locked}
    onclick={toggle}
    class="rounded-full border bg-surface-2 px-2.5 py-1 text-[13px] font-bold text-text
           disabled:cursor-not-allowed {locked ? 'border-border' : 'border-accent'}"
    class:opacity-40={disabled || locked}
  >
    {#if locked}
      <span>{lockLabel}</span>
    {:else}
      <span>{$_(currentKey)}</span> <span aria-hidden="true">▾</span>
    {/if}
  </button>

  <Popover {open} align="left" onclose={() => (open = false)}>
    <div class="w-36 rounded-xl border border-border bg-surface-2 p-1.5 shadow-xl">
      {#each MODES as opt}
        <button
          type="button"
          onclick={() => pick(opt.value)}
          class="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold
                 {opt.value === mode ? 'bg-accent text-surface' : 'text-text'}"
        >
          {$_(opt.key)}
        </button>
      {/each}
    </div>
  </Popover>
</div>
