<script>
  import { _ } from 'svelte-i18n'
  import ProgressRing from '../ui/ProgressRing.svelte'

  let {
    display = 'starting',
    fill = 0,
    kw = '0.0',
    maxKw = '',
    reasonKey = '',
    reasonValues = {},
    faultText = '',
  } = $props()

  let color = $derived(display === 'error' ? 'var(--error)' : 'var(--accent)')
</script>

<div class="flex justify-center py-1">
  <ProgressRing {fill} {color}>
    {#if display === 'charging'}
      <div class="text-5xl font-extrabold leading-none text-text">{kw}</div>
      <div class="mt-1 text-[11px] font-semibold tracking-widest text-accent">KW</div>
      {#if maxKw}
        <div class="mt-0.5 text-[9px] text-text-dim">{$_('dashboard.kw_max', { values: { max: maxKw } })}</div>
      {/if}
    {:else if display === 'idle'}
      <div class="text-lg font-extrabold text-text-dim">{$_('dashboard.ring.ready')}</div>
      <div class="px-6 text-[9px] text-text-dim">{$_('dashboard.ring.ready_sub')}</div>
    {:else if display === 'connected'}
      <div class="text-lg font-extrabold text-warning">{$_('dashboard.ring.paused')}</div>
      {#if reasonKey}
        <div class="px-5 text-[9px] text-text-dim">{$_(reasonKey, { values: reasonValues })}</div>
      {/if}
    {:else if display === 'error'}
      <div class="text-2xl text-error">⚠</div>
      <div class="px-5 text-[9px] text-error">{faultText}</div>
    {:else}
      <div class="text-lg font-extrabold text-text-dim">{$_('dashboard.ring.starting')}</div>
    {/if}
  </ProgressRing>
</div>
