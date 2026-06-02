<script>
  let { open = false, align = 'left', onclose = () => {}, children } = $props()

  function onKey(e) {
    if (open && e.key === 'Escape') onclose()
  }
</script>

<svelte:window onkeydown={onKey} />

{#if open}
  <!-- full-viewport transparent catcher for click-outside (mirrors Modal.svelte) -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="fixed inset-0 z-40" role="presentation" onclick={onclose}></div>
  <div
    class="absolute top-full z-50 mt-1 {align === 'right' ? 'right-0' : 'left-0'}"
    role="menu"
  >
    {@render children?.()}
  </div>
{/if}
