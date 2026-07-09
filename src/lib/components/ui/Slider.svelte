<script>
  import { untrack } from 'svelte'

  let {
    min = 0,
    max = 100,
    step = 1,
    value = 0,
    disabled = false,
    onchange = () => {},
    oninput = () => {},
    format = (v) => v,
    ariaLabel = '',
    showBubble = true,   // floating value popup above the thumb
  } = $props()

  let current = $state(untrack(() => value))
  $effect(() => {
    current = value
  })

  function handleInput(e) {
    current = Number(e.currentTarget.value)
    oninput(current)
  }
  function handleChange(e) {
    onchange(Number(e.currentTarget.value))
  }

  let pct = $derived(max > min ? ((current - min) / (max - min)) * 100 : 0)
</script>

<!-- pt-12 lifts the value bubble well clear of the thumb so a fingertip
     dragging on a touch screen doesn't cover the value (see -bottom caret).
     Without the bubble the headroom collapses so the track sits tight. -->
<div class="relative {showBubble ? 'pt-12' : ''}">
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
  {#if showBubble}
    <!-- Sits ~2rem above the thumb (top-0 within the pt-12 headroom) and points
         down at it with a caret, keeping the readout visible above the finger. -->
    <div
      class="pointer-events-none absolute top-0 rounded-md bg-surface-3 px-2 py-1
             text-xs font-medium text-text opacity-0 shadow-md ring-1 ring-border
             transition-opacity peer-hover:opacity-100 peer-focus:opacity-100
             peer-active:opacity-100"
      style="left: {pct}%; transform: translateX(-{pct}%)"
      aria-hidden="true"
    >
      {format(current)}
      <!-- The bubble is shifted by -pct% of its own width, so the thumb sits at
           pct% across it — place the caret there so it always points at the thumb. -->
      <span
        class="absolute top-full h-0 w-0 -translate-x-1/2
               border-x-4 border-t-4 border-x-transparent border-t-surface-3"
        style="left: {pct}%"
      ></span>
    </div>
  {/if}
</div>
