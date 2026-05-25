<script>
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'
  import { untrack } from 'svelte'

  let { opts, data } = $props()

  let container
  /** @type {uPlot | null} */
  let chart = null
  /** @type {ResizeObserver | null} */
  let ro = null
  /** @type {MutationObserver | null} */
  let mo = null

  function rebuild() {
    if (!container) return
    if (chart) { chart.destroy(); chart = null }
    const width = container.clientWidth || 600
    const currentOpts = untrack(() => opts)
    const currentData = untrack(() => data)
    const o = { ...currentOpts, width, height: currentOpts.height ?? 260 }
    chart = new uPlot(o, currentData, container)
  }

  // Rebuild only when opts changes or on mount/theme change
  $effect(() => {
    opts  // explicit dependency on opts
    rebuild()
    ro = new ResizeObserver(() => {
      if (chart && container) chart.setSize({ width: container.clientWidth, height: chart.height })
    })
    ro.observe(container)
    mo = new MutationObserver(() => rebuild())
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      ro?.disconnect()
      mo?.disconnect()
      chart?.destroy()
      chart = null
    }
  })

  // Cheap data swap whenever data changes (no destroy/recreate)
  $effect(() => {
    if (chart) chart.setData(data)
  })
</script>

<div bind:this={container} class="w-full"></div>
