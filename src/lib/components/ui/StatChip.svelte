<script>
  let { value, label } = $props()
</script>

<div class="rounded-xl bg-surface-2 px-1 py-2 text-center">
  <div class="text-base font-bold text-text">{value}</div>
  <div class="mt-0.5 text-[8px] tracking-wide text-text-dim uppercase">{label}</div>
</div>
