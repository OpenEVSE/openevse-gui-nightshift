<!-- src/lib/components/ui/TextInput.svelte -->
<script>
  import { untrack } from 'svelte'

  let {
    value = '',
    placeholder = '',
    disabled = false,
    maxlength = undefined,
    revert = 0,
    onchange = () => {},
  } = $props()

  let draft = $state(untrack(() => value))
  let focused = $state(false)

  // Resync from the confirmed store value when not editing, and whenever the
  // caller bumps `revert` (after a failed save) — even if `value` is unchanged.
  $effect(() => {
    revert
    if (!focused) draft = value
  })

  function blur() {
    focused = false
    if (draft !== value) onchange(draft)
  }
</script>

<input
  type="text"
  {placeholder}
  {disabled}
  {maxlength}
  value={draft}
  oninput={(e) => (draft = e.currentTarget.value)}
  onfocus={() => (focused = true)}
  onblur={blur}
  class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text
         placeholder:text-text-dim focus:border-accent focus:outline-none
         disabled:opacity-40"
/>
