<script>
  let { tabs = [], active = 0, onchange = () => {} } = $props()
</script>

<div class="flex gap-1 rounded-xl bg-surface-2 p-1" role="tablist">
  {#each tabs as tab, i}
    <button
      type="button"
      role="tab"
      aria-selected={i === active}
      onclick={() => onchange(i)}
      class="relative flex-1 rounded-lg py-2 text-xs font-semibold transition
             {i === active ? 'bg-accent text-surface' : 'text-text-dim'}"
    >
      {tab.label}
      {#if tab.alert}
        <span class="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-error"></span>
      {/if}
    </button>
  {/each}
</div>
