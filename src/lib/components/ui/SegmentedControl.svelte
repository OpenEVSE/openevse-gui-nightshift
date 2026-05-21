<script>
  let { options = [], value, onchange = () => {}, disabled = false } = $props()

  function pick(opt) {
    if (disabled || opt.disabled || opt.value === value) return
    onchange(opt.value)
  }
</script>

<div class="flex gap-1 rounded-xl bg-surface-2 p-1" class:opacity-40={disabled}>
  {#each options as opt}
    <button
      type="button"
      aria-pressed={opt.value === value}
      disabled={disabled || opt.disabled}
      onclick={() => pick(opt)}
      class="flex-1 rounded-lg py-2 text-xs font-semibold transition
             disabled:cursor-not-allowed
             {opt.value === value ? 'bg-accent text-surface' : 'text-text-dim'}"
    >
      {opt.label}
    </button>
  {/each}
</div>
