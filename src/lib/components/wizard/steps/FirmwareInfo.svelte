<!--
  src/lib/components/wizard/steps/FirmwareInfo.svelte

  Step 4: read-only firmware versions + reassurance that updates live
  on the Settings page after first-run.
-->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../../stores/config.js'
  import ReadOnlyRow from '../../config/ReadOnlyRow.svelte'
</script>

<div class="space-y-4">
  <p class="text-sm text-text-dim">{$_('wizard.firmware.intro')}</p>

  <div class="rounded-xl border border-border bg-surface-2 p-1">
    <ReadOnlyRow label={$_('config.about.firmware')} value={$config_store?.firmware} />
    <ReadOnlyRow label={$_('config.about.gateway')} value={$config_store?.version} />
  </div>

  <p class="text-xs text-text-dim">{$_('wizard.firmware.update_hint')}</p>
</div>
