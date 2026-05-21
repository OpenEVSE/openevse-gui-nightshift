<script>
  let { checked = false, disabled = false, label = '', onchange = () => {} } = $props()
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  onclick={() => onchange(!checked)}
  class="relative h-6 w-11 rounded-full transition disabled:opacity-40
         {checked ? 'bg-accent' : 'bg-surface-3'}"
>
  <span
    class="absolute top-0.5 h-5 w-5 rounded-full bg-surface transition-all
           {checked ? 'left-[22px]' : 'left-0.5'}"
  ></span>
</button>
