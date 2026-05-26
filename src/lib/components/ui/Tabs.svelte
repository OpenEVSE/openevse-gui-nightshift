<script>
  // `variant` — 'primary' (default) is the pill-style row used at page level;
  // 'subtle' is an underlined row meant to read as a sub-navigation under a
  // primary tab. The two are visually distinct at a glance.
  let { tabs = [], active = 0, variant = 'primary', onchange = () => {} } = $props()
</script>

{#if variant === 'subtle'}
  <div class="flex gap-4 border-b border-border" role="tablist">
    {#each tabs as tab, i}
      <button
        type="button"
        role="tab"
        aria-selected={i === active}
        onclick={() => onchange(i)}
        class="relative -mb-px border-b-2 py-1.5 text-xs font-semibold transition
               {i === active ? 'border-accent text-text' : 'border-transparent text-text-dim hover:text-text'}"
      >
        {tab.label}
        {#if tab.alert}
          <span class="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-error align-middle"></span>
        {/if}
      </button>
    {/each}
  </div>
{:else}
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
{/if}
