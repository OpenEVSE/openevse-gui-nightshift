<script>
  import { _ } from 'svelte-i18n'
  import Icon from '../../icons/Icon.svelte'

  let { limit = { type: 'none' }, summary = '', onopen = () => {}, onclear = () => {} } = $props()

  let active = $derived(limit && limit.type && limit.type !== 'none')
</script>

<div class="mt-3 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-3">
  <div>
    <div class="text-[8px] tracking-wide text-text-dim uppercase">{$_('dashboard.limit.label')}</div>
    <div class="mt-0.5 text-sm font-bold text-text">
      {active ? summary : $_('dashboard.limit.none')}
    </div>
  </div>
  {#if active}
    <button
      type="button"
      aria-label={$_('dashboard.limit.clear')}
      onclick={onclear}
      class="rounded-full p-1 text-text-dim hover:text-error"
    >
      <Icon icon="mdi:close" size={18} />
    </button>
  {:else}
    <button type="button" onclick={onopen} class="text-xs font-semibold text-accent">
      + <span>{$_('dashboard.limit.set')}</span>
    </button>
  {/if}
</div>
