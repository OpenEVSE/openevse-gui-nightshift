<script>
  let { class: klass = '', children } = $props()
</script>

<div class="rounded-2xl bg-surface-2 {klass}">
  {@render children?.()}
</div>
