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
  <!-- The dialog is capped at the viewport height and scrolls inside itself,
       so a tall form (Edit Rule) never pushes its buttons off a phone screen
       (#1403). dvh tracks the visible height as mobile browser bars come and
       go; a dialog's footer can stay in view with `sticky bottom-0`. -->
  <div
    class="fixed inset-0 z-40 grid place-items-center bg-black/55 p-4 sm:p-6"
    onclick={(e) => closable && e.target === e.currentTarget && onclose()}
    role="presentation"
  >
    <div
      class="max-h-[calc(100dvh-2rem)] w-full overflow-y-auto overscroll-contain sm:max-h-[calc(100dvh-3rem)] {widths[size]} rounded-2xl bg-surface-2 p-5 shadow-xl"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      {@render children?.()}
    </div>
  </div>
{/if}
