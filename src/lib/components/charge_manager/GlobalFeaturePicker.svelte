<script>
  import { _ } from 'svelte-i18n'
  import Modal from '../ui/Modal.svelte'
  import { GLOBAL_FEATURE_KEYS } from '../../charge_manager/rules.js'

  let {
    open = false,
    enabledKeys = [],
    // key → reason i18n key for features that can't be added (greyed out)
    unavailableKeys = {},
    onpick = () => {},
    onclose = () => {},
  } = $props()

  // Features not yet added (excludes already-enabled global features).
  // 'schedule' is always available — it creates a new scheduled rule.
  let available = $derived([
    ...GLOBAL_FEATURE_KEYS.filter((k) => !enabledKeys.includes(k)),
    'schedule',
  ])
</script>

<Modal visible={open} closable={true} {onclose}>
  <h2 class="mb-4 text-base font-semibold text-text">{$_('charge_manager.feature_picker_title')}</h2>

  <ul class="flex flex-col gap-2">
    {#each available as key}
      {@const reason = unavailableKeys[key]}
      <li>
        <button
          type="button"
          disabled={!!reason}
          onclick={() => { if (!reason) { onpick(key); onclose() } }}
          class="w-full rounded-xl bg-surface-2 px-4 py-3 text-left transition hover:bg-surface-3
                 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface-2"
        >
          <div class="text-sm font-semibold text-text">{$_('charge_manager.feature_' + key)}</div>
          <div class="mt-0.5 text-xs text-text-dim">
            {reason ? $_(reason) : $_('charge_manager.feature_' + key + '_desc')}
          </div>
        </button>
      </li>
    {/each}
  </ul>
</Modal>
