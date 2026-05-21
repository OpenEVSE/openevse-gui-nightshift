<script>
  let { min = 0, max = 100, step = 1, value = 0, disabled = false, onchange = () => {} } = $props()

  function handle(e) {
    onchange(Number(e.currentTarget.value))
  }
</script>

<input
  type="range"
  role="slider"
  {min}
  {max}
  {step}
  {value}
  {disabled}
  onchange={handle}
  class="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-3
         accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
/>
