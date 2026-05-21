<script>
  import { _ } from 'svelte-i18n'
  import Toggle from '../ui/Toggle.svelte'

  let {
    showEco = false, ecoOn = false, onEco = () => {},
    showShaper = false, shaperOn = false, onShaper = () => {},
    disabled = false,
  } = $props()
</script>

{#if showEco || showShaper}
  <div class="flex justify-center gap-6 py-2">
    {#if showEco}
      <div class="flex items-center gap-2">
        <span class="text-xs text-text-dim">{$_('dashboard.eco')}</span>
        <Toggle checked={ecoOn} {disabled} label={$_('dashboard.eco')} onchange={onEco} />
      </div>
    {/if}
    {#if showShaper}
      <div class="flex items-center gap-2">
        <span class="text-xs text-text-dim">{$_('dashboard.shaper')}</span>
        <Toggle checked={shaperOn} {disabled} label={$_('dashboard.shaper')} onchange={onShaper} />
      </div>
    {/if}
  </div>
{/if}
