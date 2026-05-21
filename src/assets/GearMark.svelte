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
  <defs>
    <mask id="oevse-keyhole">
      <rect width="100" height="100" fill="white" />
      <circle cx="50" cy="43" r="9" fill="black" />
      <path d="M46 43 L54 43 L58 60 Q59 64 55 64 L45 64 Q41 64 42 60 Z" fill="black" />
    </mask>
  </defs>
  <g fill="currentColor" mask="url(#oevse-keyhole)">
    {#each [0, 45, 90, 135, 180, 225, 270, 315] as a}
      <rect x="42.5" y="5" width="15" height="25" rx="7" transform="rotate({a} 50 50)" />
    {/each}
    <circle cx="50" cy="50" r="31" />
  </g>
</svg>
