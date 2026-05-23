<script>
  let {
    visible = false,
    closable = true,
    size = 'sm', // 'sm' (default, dialogs) | 'lg' (live consoles, big content)
    onclose = () => {},
    children,
  } = $props()

  const widths = {
    sm: 'max-w-sm',
    lg: 'max-w-4xl',
  }
</script>

{#if visible}
  <div
    class="fixed inset-0 z-40 grid place-items-center bg-black/55 p-6"
    onclick={() => closable && onclose()}
    role="presentation"
  >
    <div
      class="w-full {widths[size]} rounded-2xl bg-surface-2 p-5 shadow-xl"
      role="dialog"
      aria-modal="true"
      onclick={(e) => e.stopPropagation()}
    >
      {@render children?.()}
    </div>
  </div>
{/if}
