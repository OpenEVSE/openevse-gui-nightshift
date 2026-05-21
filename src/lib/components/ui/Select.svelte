<script>
  let { options = [], value, disabled = false, onchange = () => {} } = $props()
</script>

<select
  {disabled}
  value={value}
  onchange={(e) => onchange(e.currentTarget.value)}
  class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text
         disabled:opacity-40"
>
  {#each options as opt}
    <option value={opt.value} disabled={opt.disabled}>{opt.label}</option>
  {/each}
</select>
