<script>
  // Pull-to-refresh wrapper. Place around a route's content; fires onrefresh
  // (an async fn) when the user pulls past the threshold.
  //
  // Assumptions:
  // - The wrapper expects to be *inside* the main scroll container (AppShell's
  //   <main>). It walks up to find the nearest scrolling ancestor and only
  //   activates when that ancestor's scrollTop === 0.
  // - Touch listeners use passive: true to avoid blocking the page's own
  //   scrolling. The wrapper translates itself with transform — the underlying
  //   scroll keeps working as long as the user isn't at the top edge.
  // - sm: and up (desktop / large tablet) the wrapper is a no-op — pull is a
  //   touch idiom and would surprise mouse users.
  import { computePull, PULL_THRESHOLD_PX } from '../../pullRefresh.js'

  let { onrefresh = async () => {}, children } = $props()

  let wrapperEl
  let displacement = $state(0)
  let armed = $state(false)
  let refreshing = $state(false)
  let startY = null
  let scroller = null

  function findScroller(el) {
    let n = el?.parentElement
    while (n) {
      const o = getComputedStyle(n).overflowY
      if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n
      n = n.parentElement
    }
    // Fall back to documentElement (the page itself scrolls).
    return document.documentElement
  }

  function onTouchStart(e) {
    if (refreshing) return
    if (!scroller) scroller = findScroller(wrapperEl)
    if (scroller.scrollTop > 0) return
    startY = e.touches[0].clientY
  }

  function onTouchMove(e) {
    if (startY == null || refreshing) return
    const next = computePull(startY, e.touches[0].clientY)
    displacement = next.displacement
    armed = next.armed
  }

  async function onTouchEnd() {
    if (startY == null || refreshing) {
      startY = null
      return
    }
    startY = null
    if (armed) {
      refreshing = true
      displacement = PULL_THRESHOLD_PX
      try { await onrefresh() } catch { /* swallow — UI shouldn't crash on a failed refresh */ }
      refreshing = false
    }
    displacement = 0
    armed = false
  }
</script>

<!-- IMPORTANT: do NOT emit a `transform: translateY(0px)` when idle.
     Even zero translateY is a *defined* transform (not `none`), and on iOS
     standalone PWAs that promotes the element to a permanent stacking
     context / compositor candidate which gates env(safe-area-inset-*)
     resolution for the whole page until *some* transform change happens.
     That manifested as a gap below BottomNav on launch that only closed
     when the user pulled (the first non-zero transform of the session).
     Only emit the transform while actively pulling or animating. -->
<div
  bind:this={wrapperEl}
  class="relative"
  role="region"
  aria-label="Pull to refresh"
  style={displacement > 0 || refreshing
    ? `transform: translateY(${displacement}px); transition: ${refreshing ? 'transform 220ms ease' : 'none'};`
    : 'transition: transform 220ms ease;'}
  ontouchstart={onTouchStart}
  ontouchmove={onTouchMove}
  ontouchend={onTouchEnd}
  ontouchcancel={onTouchEnd}
>
  {#if displacement > 0 || refreshing}
    <!-- Pull indicator sits above the content, riding along with the drag. -->
    <div
      class="pointer-events-none absolute left-0 right-0 -top-10 flex justify-center"
      aria-hidden="true"
    >
      <div
        class="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-text-dim shadow"
      >
        {#if refreshing}
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-text-dim border-t-transparent"></span>
        {:else}
          <span
            class="inline-block h-4 w-4 origin-center border-text-dim"
            style={`transform: rotate(${Math.min(displacement * 2.5, 180)}deg); transition: none;`}
          >↓</span>
        {/if}
      </div>
    </div>
  {/if}

  {@render children?.()}
</div>
