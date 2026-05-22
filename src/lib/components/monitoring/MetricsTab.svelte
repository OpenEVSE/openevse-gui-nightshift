<script>
  import MetricGroup from './MetricGroup.svelte'

  let { groups = [] } = $props()
</script>

<div>
  {#each groups as g}
    <MetricGroup group={g.group} expanded={g.expanded} />
  {/each}
</div>
