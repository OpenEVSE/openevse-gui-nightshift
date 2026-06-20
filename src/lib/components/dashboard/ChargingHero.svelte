<script>
  import { _ } from 'svelte-i18n'
  import StatusLine from './StatusLine.svelte'
  import RatePill from './RatePill.svelte'
  import SessionChart from './SessionChart.svelte'

  let {
    kw = '0.0',
    soc = null,
    target = null,
    hasSoc = false,
    amps = 6,
    maxAmps = 48,
    rateClaimedBy = '',
    rateNonce = 0,
    samples = [],
    voltage = 0,
    phases = 1,
    sessionElapsed = 0,
    chartError = false,
    rateDisabled = false,
    onrate = () => {},
  } = $props()
</script>

<div>
  <!-- status row: "Charging" · rate pill -->
  <div class="flex items-center justify-between gap-2 px-1">
    <StatusLine display="charging" />
    {#key rateNonce}
      <RatePill {amps} min={6} max={maxAmps} claimedBy={rateClaimedBy} disabled={rateDisabled} onchange={onrate} />
    {/key}
  </div>

  <!-- readout strip: keeps the ring's at-a-glance kW · SOC identity -->
  <div class="flex items-center justify-center gap-6 py-3">
    <div class="text-center">
      <div class="text-4xl font-extrabold leading-none text-text">{kw}</div>
      <div class="mt-0.5 text-[10px] font-bold tracking-widest text-accent">KW</div>
    </div>
    {#if hasSoc && soc != null}
      <div class="w-px self-stretch bg-border"></div>
      <div class="text-center">
        <div class="text-4xl font-extrabold leading-none text-text">{Math.round(soc)}<span class="text-xl">%</span></div>
        <div class="mt-0.5 text-[10px] font-bold tracking-wide text-text-dim">
          {#if target != null}
            {$_('dashboard.session.soc_target', { values: { target } })}
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if !chartError}
    <SessionChart {samples} {voltage} {phases} {target} {sessionElapsed} />
  {/if}
</div>
