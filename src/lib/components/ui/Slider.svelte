<script>
  let {
    min = 0,
    max = 100,
    step = 1,
    value = 0,
    disabled = false,
    onchange = () => {},
    format = (v) => v,
    ariaLabel = '',
  } = $props()

  let current = $state(value)
  $effect(() => {
    current = value
  })

  function handleInput(e) {
    current = Number(e.currentTarget.value)
  }
  function handleChange(e) {
    onchange(Number(e.currentTarget.value))
  }

  let pct = $derived(max > min ? ((current - min) / (max - min)) * 100 : 0)
</script>

<div class="relative pt-7">
  <input
    type="range"
    aria-label={ariaLabel || undefined}
    {min}
    {max}
    {step}
    value={current}
    {disabled}
    oninput={handleInput}
    onchange={handleChange}
    class="peer h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-3
           accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
  />
  <div
    class="pointer-events-none absolute top-0 rounded-md bg-surface-3 px-1.5 py-0.5
           text-xs font-medium text-text opacity-0 shadow ring-1 ring-border
           transition-opacity peer-hover:opacity-100 peer-focus:opacity-100
           peer-active:opacity-100"
    style="left: {pct}%; transform: translateX(-{pct}%)"
    aria-hidden="true"
  >
    {format(current)}
  </div>
</div>
