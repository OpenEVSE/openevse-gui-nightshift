<!-- src/lib/components/ui/PasswordInput.svelte -->
<script>
  import { untrack } from 'svelte'
  import Icon from '../../icons/Icon.svelte'
  import { isDummyPassword } from '../../config/validate.js'

  let {
    value = '',
    placeholder = '',
    disabled = false,
    maxlength = undefined,
    revert = 0,
    onchange = () => {},
  } = $props()

  let draft = $state(untrack(() => (isDummyPassword(value) ? '' : value)))
  let focused = $state(false)
  let show = $state(false)

  $effect(() => {
    revert
    if (!focused) draft = isDummyPassword(value) ? '' : value
  })

  function blur() {
    focused = false
    // Empty draft on a field that still holds the device sentinel = untouched.
    if (draft === '' && isDummyPassword(value)) return
    if (draft !== value) onchange(draft)
  }
</script>

<div class="relative">
  <input
    type={show ? 'text' : 'password'}
    placeholder={isDummyPassword(value) ? '••••••••••' : placeholder}
    {disabled}
    {maxlength}
    value={draft}
    oninput={(e) => (draft = e.currentTarget.value)}
    onfocus={() => (focused = true)}
    onblur={blur}
    class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 pr-10 text-sm
           text-text placeholder:text-text-dim focus:border-accent focus:outline-none
           disabled:opacity-40"
  />
  <button
    type="button"
    aria-label={show ? 'hide' : 'show'}
    onclick={() => (show = !show)}
    class="absolute inset-y-0 right-0 grid w-10 place-items-center text-text-dim"
  >
    <Icon icon={show ? 'mdi:eye-off-outline' : 'mdi:eye-outline'} size={18} />
  </button>
</div>
