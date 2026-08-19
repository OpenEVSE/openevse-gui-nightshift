<!--
  The OpenEVSE charge point: an outlined wall unit with the bolt on its face and
  two cords off the bottom, as the real hardware has — the J1772 lead sweeping
  right, and the AC feed dropping straight down into a plug. Enclosure
  proportions come off the real unit (a tall portrait box, roughly 1:1.4);
  squarer than this reads as a letter Q, taller reads as a phone.

  The plug's two pins only resolve above ~32px. Below that it collapses to a
  solid block, which is intentional — the silhouette holds, it just loses
  detail rather than turning to mush.

  Geometry is offset (+4.6, -3.0) from a naive layout so the drawn bounds sit
  centred in the 100x100 box: the plug pushes the composition low and left, and
  scripts/gen-icons.mjs rasterises the whole viewBox, so any dead space would
  show up as an off-centre PNG icon.

  The shell, cords and plug are currentColor so the mark follows the theme
  accent; only the bolt is fixed. Its colour lives in --mark-bolt (src/app.css)
  with the value inlined as a fallback, because gen-icons.mjs rasterises the
  twin of this file (mark.svg) outside any stylesheet.

  Unlike the gear this replaces, nothing here needs a <mask>, so there are no
  document-unique ids to collide.
-->
<script>
  let { size = 32, class: klass = '' } = $props()
</script>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"
  width={size} height={size} class={klass} role="img" aria-label="OpenEVSE">
  <rect x="20.6" y="10" width="46" height="66" rx="11"
    fill="none" stroke="currentColor" stroke-width="7" />
  <path d="M52.67 19L28.13 47.8L42 47.8L37.2 67L59.07 37.13L45.73 37.13Z"
    fill="var(--mark-bolt, #8b5cf6)" />
  <path d="M52.6 76C52.6 83 64.6 87 80.6 82"
    fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" />
  <path d="M34.6 76L34.6 84"
    fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" />
  <rect x="28.1" y="84" width="13" height="5.4" rx="2.6" fill="currentColor" />
  <rect x="29.7" y="89.4" width="3" height="4.1" rx="1.5" fill="currentColor" />
  <rect x="36.5" y="89.4" width="3" height="4.1" rx="1.5" fill="currentColor" />
</svg>
