<!--
  The OpenEVSE charge point: an outlined wall unit with the bolt on its face and
  two cords off the bottom, as the real hardware has — the J1772 lead sweeping
  right, and the AC feed elbowing out to the left into a plug. Enclosure
  proportions come off the real unit (a tall portrait box, roughly 1:1.4);
  squarer than this reads as a letter Q, taller reads as a phone.

  The left cord turns and runs sideways rather than hanging down, for two
  reasons. It leaves clear air between the plug and the case, so the plug reads
  as a separate object instead of a foot. And the mark scales to its longest
  dimension, which is the height: a plug hanging below adds its whole footprint
  to that, shrinking the enclosure ~5%, whereas turning it sideways spends the
  width, where there was ~20 units of slack. The second cord and its plug end
  up costing 3% instead.

  The pins run 3 units deeper than they look: they have to pass the body's
  2.6 corner radius, or they meet a curved edge and leave a notch at the join.
  The overlap is invisible because both are currentColor.

  The plug's two pins only resolve above ~32px. Below that it collapses to a
  solid block, which is intentional — the silhouette holds, it just loses
  detail rather than turning to mush.

  Geometry is offset (+4.6, -2.0) from a naive layout so the drawn bounds sit
  centred in the 100x100 box. scripts/gen-icons.mjs rasterises the whole
  viewBox, so any dead space would show up as an off-centre PNG icon.

  The shell, cords and plug are currentColor so the mark follows the theme
  accent; only the bolt is fixed. Its colour lives in --mark-bolt (src/app.css)
  with the value inlined as a fallback, because gen-icons.mjs rasterises the
  twin of this file (mark.svg) outside any stylesheet.

  Unlike the gear this replaces, nothing here needs a <mask>, so there are no
  document-unique ids to collide.

  Decorative by default: every placement so far sits beside text that already
  names the product, so labelling the mark too made screen readers announce it
  twice. Pass `label` for a standalone use where nothing else names it.
-->
<script>
  let { size = 32, class: klass = '', label = '' } = $props()
</script>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"
  width={size} height={size} class={klass}
  role={label ? 'img' : undefined}
  aria-label={label || undefined}
  aria-hidden={label ? undefined : 'true'}>
  <rect x="20.6" y="11" width="46" height="66" rx="11"
    fill="none" stroke="currentColor" stroke-width="7" />
  <path d="M52.67 20L28.13 48.8L42 48.8L37.2 68L59.07 38.13L45.73 38.13Z"
    fill="var(--mark-bolt, #8b5cf6)" />
  <path d="M52.6 77C52.6 84 64.6 88 80.6 83"
    fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" />
  <path d="M34.6 77C34.6 84 31.6 86 26.6 86"
    fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" />
  <rect x="21.2" y="79.5" width="5.4" height="13" rx="2.6" fill="currentColor" />
  <rect x="17.1" y="81.1" width="7.1" height="3" rx="1.5" fill="currentColor" />
  <rect x="17.1" y="87.9" width="7.1" height="3" rx="1.5" fill="currentColor" />
</svg>
