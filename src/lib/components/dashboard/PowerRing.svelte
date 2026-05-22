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

  // Ring colour tracks the charge state: accent while charging/idle,
  // amber when paused (connected but not charging), red on a fault.
  let color = $derived(
    display === 'error'
      ? 'var(--error)'
      : display === 'connected'
        ? 'var(--warning)'
        : 'var(--accent)',
  )
  // While charging the ring shows charge progress; in the paused and fault
  // states it becomes a solid colour-coded indicator ring.
  let ringFill = $derived(
    display === 'charging' ? fill : display === 'connected' || display === 'error' ? 1 : 0,
  )
</script>

<div class="flex justify-center py-1">
  <ProgressRing fill={ringFill} {color}>
    {#if display === 'charging'}
      <div class="relative h-full w-full">
        <!-- kW value: centered both axes within the ring -->
        <div class="absolute inset-0 grid place-items-center">
          <div class="text-5xl font-extrabold leading-none text-text">{kw}</div>
        </div>
        <!-- KW label + max: stacked just below the centered value -->
        <div class="absolute inset-x-0 top-1/2 flex flex-col items-center pt-6">
          <div class="text-[11px] font-semibold tracking-widest text-accent">KW</div>
          {#if maxKw}
            <div class="mt-0.5 text-[11px] text-text-dim">{$_('dashboard.kw_max', { values: { max: maxKw } })}</div>
          {/if}
        </div>
      </div>
    {:else if display === 'idle'}
      <div class="text-lg font-extrabold text-text-dim">{$_('dashboard.ring.ready')}</div>
      <div class="px-6 text-[11px] text-text-dim">{$_('dashboard.ring.ready_sub')}</div>
    {:else if display === 'connected'}
      <div class="relative h-full w-full">
        <!-- "Paused": centered both axes within the ring -->
        <div class="absolute inset-0 grid place-items-center">
          <div class="text-xl font-extrabold leading-none text-warning">
            {$_('dashboard.ring.paused')}
          </div>
        </div>
        <!-- reason: stacked just below the centered word -->
        {#if reasonKey}
          <div class="absolute inset-x-0 top-1/2 flex flex-col items-center pt-7">
            <div class="px-5 text-center text-[11px] text-text-dim">
              {$_(reasonKey, { values: reasonValues })}
            </div>
          </div>
        {/if}
      </div>
    {:else if display === 'error'}
      <div class="flex flex-col items-center">
        <div class="text-4xl leading-none text-error">⚠</div>
        <div class="mt-1 text-xl font-extrabold tracking-wide text-error">
          {$_('dashboard.ring.fault')}
        </div>
        {#if faultText}
          <div class="mt-1 px-5 text-center text-[11px] text-text-dim">{faultText}</div>
        {/if}
      </div>
    {:else}
      <div class="text-lg font-extrabold text-text-dim">{$_('dashboard.ring.starting')}</div>
    {/if}
  </ProgressRing>
</div>
