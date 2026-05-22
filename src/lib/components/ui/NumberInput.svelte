<!-- src/lib/components/ui/NumberInput.svelte -->
<script>
  let {
    value = null,
    min = undefined,
    max = undefined,
    step = 1,
    placeholder = '',
    disabled = false,
    revert = 0,
    onchange = () => {},
  } = $props()

  let draft = $state(value ?? '')
  let focused = $state(false)

  $effect(() => {
    revert
    if (!focused) draft = value ?? ''
  })

  function emit() {
    focused = false
    const next = draft === '' ? null : Number(draft)
    if (next !== value) onchange(next)
  }
</script>

<input
  type="number"
  {min}
  {max}
  {step}
  {placeholder}
  {disabled}
  value={draft}
  oninput={(e) => (draft = e.currentTarget.value)}
  onfocus={() => (focused = true)}
  onblur={emit}
  class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text
         placeholder:text-text-dim focus:border-accent focus:outline-none
         disabled:opacity-40"
/>
