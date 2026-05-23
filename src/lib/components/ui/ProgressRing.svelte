<script>
  let {
    fill = 0,
    color = 'var(--accent)',
    track = 'var(--surface-3)',
    size = 178,
    thickness = 15,
    /** Apply a slow opacity breath. Use for passive / fault states. */
    pulse = false,
    children,
  } = $props()

  let deg = $derived(Math.max(0, Math.min(1, fill)) * 360)
  let inner = $derived(size - thickness * 2)
</script>

<div
  class="grid place-items-center rounded-full"
  class:breathe={pulse}
  style="width:{size}px;height:{size}px;background:conic-gradient({color} {deg}deg, {track} {deg}deg);"
>
  <div
    class="grid place-items-center rounded-full bg-surface text-center"
    style="width:{inner}px;height:{inner}px;"
  >
    {@render children?.()}
  </div>
</div>

<style>
  /* Slow opacity breath — telegraphs "we're sitting here waiting" or
     "something needs your attention". Whole ring fades together so the
     animation reads as one shape, not a flickering border. */
  .breathe {
    animation: breathe 2.6s ease-in-out infinite;
  }
  @keyframes breathe {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }
  /* Respect the OS reduced-motion preference. */
  @media (prefers-reduced-motion: reduce) {
    .breathe { animation: none; }
  }
</style>
