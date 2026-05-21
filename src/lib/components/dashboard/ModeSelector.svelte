<script>
  import { _ } from 'svelte-i18n'
  import SegmentedControl from '../ui/SegmentedControl.svelte'

  let { mode = 0, disabled = false, onmode = () => {} } = $props()

  let options = $derived([
    { value: 0, label: $_('dashboard.mode.auto') },
    { value: 1, label: $_('dashboard.mode.on') },
    { value: 2, label: $_('dashboard.mode.off') },
  ])
</script>

<div class="pt-1">
  <div class="mb-1.5 text-[9px] tracking-wide text-text-dim uppercase">
    {$_('dashboard.mode.label')}
  </div>
  <SegmentedControl {options} value={mode} {disabled} onchange={onmode} />
</div>
