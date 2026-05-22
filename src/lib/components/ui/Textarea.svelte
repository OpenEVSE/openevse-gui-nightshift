<!-- src/lib/components/ui/Textarea.svelte -->
<script>
  let {
    value = '',
    placeholder = '',
    rows = 4,
    disabled = false,
    monospace = false,
    onchange = () => {},
  } = $props()
</script>

<textarea
  {placeholder}
  {rows}
  {disabled}
  {value}
  onchange={(e) => onchange(e.currentTarget.value)}
  class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text
         placeholder:text-text-dim focus:border-accent focus:outline-none
         disabled:opacity-40 {monospace ? 'font-mono text-xs' : ''}"
></textarea>
