<!--
  The OpenEVSE charge point: an outlined wall unit with the bolt on its face and
  the cord off the bottom. Proportioned off the real hardware (a tall portrait
  enclosure, roughly 1:1.4) — squarer than this reads as a letter Q, taller reads
  as a phone.

  The shell and cord are currentColor so the mark follows the theme accent; only
  the bolt is fixed. Its colour lives in --mark-bolt (src/app.css) with the value
  inlined as a fallback, because scripts/gen-icons.mjs rasterises the twin of this
  file (mark.svg) outside any stylesheet.

  Unlike the gear this replaces, nothing here needs a <mask>, so there are no
  document-unique ids to collide.
-->
<script>
  let { size = 32, class: klass = '' } = $props()
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 100 100"
  width={size}
  height={size}
  class={klass}
  role="img"
  aria-label="OpenEVSE"
>
  <rect
    x="16" y="13" width="46" height="66" rx="11"
    fill="none" stroke="currentColor" stroke-width="7"
  />
  <path
    d="M48.07 22L23.53 50.8L37.4 50.8L32.6 70L54.47 40.13L41.13 40.13Z"
    fill="var(--mark-bolt, #8b5cf6)"
  />
  <path
    d="M39 79C39 88 60 94 86 86"
    fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"
  />
</svg>
