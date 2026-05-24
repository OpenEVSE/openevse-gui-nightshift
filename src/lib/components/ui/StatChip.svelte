<script>
  let { value, label, sub = null } = $props()
</script>

<div class="rounded-xl bg-surface-2 px-1 py-2 text-center">
  <div class="text-base font-bold text-text">{value}</div>
  {#if sub}
    <div class="text-[10px] font-semibold text-accent">{sub}</div>
  {/if}
  <div class="mt-0.5 text-[8px] tracking-wide text-text-dim uppercase">{label}</div>
</div>
