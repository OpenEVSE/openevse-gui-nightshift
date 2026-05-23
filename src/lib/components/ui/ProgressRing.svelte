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

<!-- @keyframes breathe lives in src/app.css; the animation is wired
     via an inline style here because the class:breathe directive was
     producing no visible effect in the bundle, possibly due to HMR
     keeping a stale CSS rule. Inline style is foolproof. -->
<div
  class="grid place-items-center rounded-full"
  style="
    width:{size}px;
    height:{size}px;
    background:conic-gradient({color} {deg}deg, {track} {deg}deg);
    transform-origin:center;
    {pulse ? 'animation: breathe 2.2s ease-in-out infinite;' : ''}
  "
>
  <div
    class="grid place-items-center rounded-full bg-surface text-center"
    style="width:{inner}px;height:{inner}px;"
  >
    {@render children?.()}
  </div>
</div>
