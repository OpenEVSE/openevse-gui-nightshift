<script>
  let { value = 0 } = $props()
  let clamped = $derived(Math.max(0, Math.min(100, value)))
</script>

<div
  role="progressbar"
  aria-valuenow={clamped}
  aria-valuemin="0"
  aria-valuemax="100"
  class="h-2 w-full overflow-hidden rounded-full bg-surface-3"
>
  <div class="h-full rounded-full bg-accent transition-[width] duration-300" style="width:{clamped}%"></div>
</div>
