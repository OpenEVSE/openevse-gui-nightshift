<script>
  import { _ } from 'svelte-i18n'
  import Modal from '../ui/Modal.svelte'
  import Select from '../ui/Select.svelte'
  import Slider from '../ui/Slider.svelte'
  import Button from '../ui/Button.svelte'

  let { open = false, allowSoc = false, allowRange = false, onclose = () => {}, onsave = () => {} } = $props()

  let type = $state('energy')
  let energyKwh = $state(5)
  let hours = $state(2)
  let minutes = $state(0)
  let socPct = $state(80)
  let rangeKm = $state(200)

  $effect(() => {
    if (open) {
      type = 'energy'
      energyKwh = 5
      hours = 2
      minutes = 0
      socPct = 80
      rangeKm = 200
    }
  })

  let typeOptions = $derived([
    { value: 'time', label: $_('dashboard.limit.type_time') },
    { value: 'energy', label: $_('dashboard.limit.type_energy') },
    { value: 'soc', label: $_('dashboard.limit.type_soc'), disabled: !allowSoc },
    { value: 'range', label: $_('dashboard.limit.type_range'), disabled: !allowRange },
  ])

  function save() {
    let value = 0
    if (type === 'time') value = hours * 60 + minutes
    else if (type === 'energy') value = Math.round(energyKwh * 1000)
    else if (type === 'soc') value = socPct
    else if (type === 'range') value = rangeKm
    onsave({ type, value, auto_release: true })
  }
</script>

<Modal visible={open} closable={true} {onclose}>
  <h2 class="mb-3 text-base font-semibold text-text">{$_('dashboard.limit.label')}</h2>

  <label class="mb-1 block text-[10px] tracking-wide text-text-dim uppercase">
    {$_('dashboard.limit.type')}
  </label>
  <Select options={typeOptions} value={type} onchange={(v) => (type = v)} />

  <div class="mt-4">
    {#if type === 'time'}
      <div class="flex items-center justify-between text-sm text-text">
        <span>{$_('dashboard.limit.hours')}: {hours}</span>
        <span>{$_('dashboard.limit.minutes')}: {minutes}</span>
      </div>
      <Slider min={0} max={24} step={1} value={hours} onchange={(v) => (hours = v)} />
      <Slider min={0} max={55} step={5} value={minutes} onchange={(v) => (minutes = v)} />
    {:else if type === 'energy'}
      <div class="mb-1 text-sm text-text">{$_('dashboard.limit.energy_value')}: {energyKwh}</div>
      <Slider min={1} max={100} step={1} value={energyKwh} onchange={(v) => (energyKwh = v)} />
    {:else if type === 'soc'}
      <div class="mb-1 text-sm text-text">{socPct}%</div>
      <Slider min={1} max={100} step={1} value={socPct} onchange={(v) => (socPct = v)} />
    {:else if type === 'range'}
      <div class="mb-1 text-sm text-text">{rangeKm} km</div>
      <Slider min={10} max={600} step={10} value={rangeKm} onchange={(v) => (rangeKm = v)} />
    {/if}
  </div>

  <div class="mt-5">
    <Button label={$_('dashboard.limit.save')} onclick={save} />
  </div>
</Modal>
