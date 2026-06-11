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
    // optional emphasized second line under the reason (e.g. the timer's resume time)
    reasonDetail = null,
    faultText = '',
  } = $props()

  // Ring colour tracks the charge state: accent while charging/idle,
  // amber when paused (connected but not charging), red on a fault,
  // a soft sleepy blue while sleeping, muted grey when manually off.
  let color = $derived(
    display === 'error'
      ? 'var(--error)'
      : display === 'connected'
        ? 'var(--warning)'
        : display === 'sleeping'
          ? 'var(--sleep)'
          : display === 'off'
            ? 'var(--text-dim)'
            : display === 'idle'
              ? 'var(--success)' // ready: a true green, distinct from the teal accent
              : 'var(--accent)',
  )
  // While charging the ring shows charge progress; in the ready / paused /
  // fault / sleeping / off states it becomes a solid colour-coded indicator ring.
  let ringFill = $derived(
    display === 'charging'
      ? fill
      : ['idle', 'connected', 'error', 'sleeping', 'off'].includes(display) ? 1 : 0,
  )
  // Breathe in ready (armed and waiting), passive (paused) and fault states.
  // Sleeping gets a light breath (it's also waiting on something). Off is a
  // deliberate stop — a static ring reinforces that nothing is happening.
  let pulse = $derived(['idle', 'connected', 'error', 'sleeping'].includes(display))
</script>

<div class="flex justify-center py-1">
  <ProgressRing fill={ringFill} {color} {pulse}>
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
      <div class="relative h-full w-full">
        <!-- "Ready": centered both axes within the ring (matches Paused/Sleeping) -->
        <div class="absolute inset-0 grid place-items-center">
          <div class="text-[22px] font-extrabold leading-none text-success">{$_('dashboard.ring.ready')}</div>
        </div>
        <!-- sub-line: stacked just below the centered word -->
        <div class="absolute inset-x-0 top-1/2 flex flex-col items-center pt-6">
          <div class="px-6 text-center text-[11px] leading-tight text-text-dim">
            {$_('dashboard.ring.ready_sub')}
          </div>
        </div>
      </div>
    {:else if display === 'connected'}
      <div class="relative h-full w-full">
        <!-- "Paused": centered both axes within the ring -->
        <div class="absolute inset-0 grid place-items-center">
          <div class="text-[22px] font-extrabold leading-none text-warning">
            {$_('dashboard.ring.paused')}
          </div>
        </div>
        <!-- reason: stacked just below the centered word -->
        {#if reasonKey}
          <div class="absolute inset-x-0 top-1/2 flex flex-col items-center pt-6">
            <div class="px-7 text-center text-[11px] leading-tight text-text-dim">
              {$_(reasonKey, { values: reasonValues })}
            </div>
            {#if reasonDetail}
              <div class="mt-0.5 text-center text-xs font-semibold leading-tight text-text">
                {$_(reasonDetail.key, { values: reasonDetail.values })}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {:else if display === 'sleeping'}
      <div class="relative h-full w-full">
        <!-- "Sleeping": centered both axes within the ring -->
        <div class="absolute inset-0 grid place-items-center">
          <div class="text-[22px] font-extrabold leading-none text-sleep">
            {$_('dashboard.ring.sleeping')}
          </div>
        </div>
        <!-- reason (e.g. "Waiting · 00:00") sits just below the label -->
        {#if reasonKey}
          <div class="absolute inset-x-0 top-1/2 flex flex-col items-center pt-6">
            <div class="px-7 text-center text-[11px] leading-tight text-text-dim">
              {$_(reasonKey, { values: reasonValues })}
            </div>
            {#if reasonDetail}
              <div class="mt-0.5 text-center text-xs font-semibold leading-tight text-text">
                {$_(reasonDetail.key, { values: reasonDetail.values })}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {:else if display === 'off'}
      <div class="text-[22px] font-extrabold leading-none text-text-dim">
        {$_('dashboard.ring.off')}
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
