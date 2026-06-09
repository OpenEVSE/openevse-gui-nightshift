<script>
  import { _ } from 'svelte-i18n'
  import VehicleSocBar from './VehicleSocBar.svelte'
  import LimitSliderBar from './LimitSliderBar.svelte'

  let {
    // vehicle-bar inputs
    hasSoc = false,
    soc = 0,
    vehicleLimit = null,
    target = 80,
    range = null,
    rangeMiles = false,
    timeToFull = 0,
    charging = false,
    estMaxRange = null,
    disabled = false,
    ontarget = () => {},
    onunit = () => {},
    // limit state + inline editors
    limit = { type: 'none' },
    elapsedSec = 0,
    sessionWh = 0,
    systemLimit = false,
    onlimit = () => {},
  } = $props()

  let canRange = $derived(hasSoc && Number.isFinite(estMaxRange))
  let pills = $derived([
    ...(hasSoc ? [{ id: 'soc', labelKey: 'dashboard.limit.type_soc' }] : []),
    ...(canRange ? [{ id: 'range', labelKey: 'dashboard.limit.type_range' }] : []),
    { id: 'time', labelKey: 'dashboard.limit.type_time' },
    { id: 'energy', labelKey: 'dashboard.limit.type_energy' },
  ])

  // The active limit's pill is the default; a manual pick overrides it (same
  // userUnit pattern as the Dashboard). Clamp to an available pill in case a
  // range limit is active but the range estimate has gone away.
  let activeType = $derived(limit?.type && limit.type !== 'none' ? limit.type : null)
  let userPick = $state(null)
  let selected = $derived.by(() => {
    const want = userPick ?? activeType ?? (hasSoc ? 'soc' : 'time')
    return pills.some((p) => p.id === want) ? want : pills[0].id
  })

  function pick(id) {
    userPick = id
    if (id === 'soc') onunit('percent')
    else if (id === 'range') onunit('range')
  }

  // Only the editor of the ACTIVE system limit is read-only; other editors
  // stay usable (committing them overrides the default for this session and
  // leaves the config untouched).
  let editorDisabled = $derived((id) => disabled || (systemLimit && activeType === id))
</script>

<div class="mt-3 rounded-xl bg-surface-2 px-3 py-3">
  <div role="radiogroup" aria-label={$_('dashboard.limit.pills_aria')} class="mb-1 flex gap-1.5">
    {#each pills as pill}
      <button
        type="button"
        role="radio"
        aria-checked={selected === pill.id}
        onclick={() => pick(pill.id)}
        class="relative rounded-full border px-3 py-1 text-[11px] font-semibold transition
               {selected === pill.id
                 ? 'border-accent text-accent'
                 : 'border-border text-text-dim'}"
      >
        {$_(pill.labelKey)}
        {#if activeType === pill.id}
          <span data-active-dot class="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent"></span>
        {/if}
      </button>
    {/each}
  </div>

  {#if selected === 'soc' || selected === 'range'}
    <VehicleSocBar
      {soc}
      {vehicleLimit}
      {target}
      {range}
      {rangeMiles}
      {timeToFull}
      {charging}
      unit={selected === 'range' ? 'range' : 'percent'}
      {estMaxRange}
      disabled={editorDisabled(selected)}
      onchange={ontarget}
    />
  {:else}
    <LimitSliderBar
      kind={selected}
      value={activeType === selected ? (limit?.value ?? 0) : 0}
      progress={selected === 'time' ? elapsedSec : sessionWh}
      {charging}
      disabled={editorDisabled(selected)}
      onchange={(v) => onlimit({ type: selected, value: v })}
    />
  {/if}
</div>
