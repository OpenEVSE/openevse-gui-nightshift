<script>
  let {
    visible = false,
    closable = true,
    size = 'sm', // 'sm' (default, dialogs) | 'md' (roomier dialogs) | 'lg' (live consoles, big content)
    onclose = () => {},
    children,
  } = $props()

  const widths = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-4xl',
  }
</script>

{#if visible}
  <!-- The target check means only clicks on the backdrop itself close —
       clicks inside the dialog hit a child, so the dialog needs no click
       handler of its own. -->
  <div
    class="fixed inset-0 z-40 grid place-items-center bg-black/55 p-6"
    onclick={(e) => closable && e.target === e.currentTarget && onclose()}
    role="presentation"
  >
    <div
      class="w-full {widths[size]} rounded-2xl bg-surface-2 p-5 shadow-xl"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      {@render children?.()}
    </div>
  </div>
{/if}
