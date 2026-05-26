<script>
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'
  import { untrack } from 'svelte'

  // `fill` makes the chart size to its parent container's height (use inside
  // a flex column with min-h-0 flex-1). When false, uPlot uses opts.height.
  let { opts, data, fill = false } = $props()

  let container
  /** @type {uPlot | null} */
  let chart = null
  /** @type {ResizeObserver | null} */
  let ro = null
  /** @type {MutationObserver | null} */
  let mo = null

  function computeSize() {
    const width = container.clientWidth || 600
    const fallback = (untrack(() => opts).height) ?? 260
    const height = fill ? (container.clientHeight || fallback) : fallback
    return { width, height }
  }

  function rebuild() {
    if (!container) return
    if (chart) { chart.destroy(); chart = null }
    const currentOpts = untrack(() => opts)
    const currentData = untrack(() => data)
    const { width, height } = computeSize()
    const o = { ...currentOpts, width, height }
    chart = new uPlot(o, currentData, container)
  }

  // Mount-only effect: builds the chart once, sets up observers, tears down on unmount.
  // untrack() in rebuild() prevents this effect from re-running on data/opts changes.
  $effect(() => {
    rebuild()
    ro = new ResizeObserver(() => {
      if (chart && container) chart.setSize(computeSize())
    })
    ro.observe(container)
    // In fill mode also observe the parent so the chart picks up height changes
    // when the surrounding flex layout reflows (e.g. window resize, tab switch).
    if (fill && container.parentElement) ro.observe(container.parentElement)
    mo = new MutationObserver(() => rebuild())
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      ro?.disconnect()
      mo?.disconnect()
      chart?.destroy()
      chart = null
    }
  })

  // Cheap data swap path — runs on every data change without rebuilding the canvas.
  $effect(() => {
    if (chart) chart.setData(data)
  })

  // Opts swap path — opts changes usually mean theme/scale rebuild is needed.
  // Full rebuild because uPlot can't live-swap most options.
  $effect(() => {
    void opts
    if (chart) rebuild()
  })
</script>

<div bind:this={container} class={fill ? 'h-full w-full' : 'w-full'}></div>
