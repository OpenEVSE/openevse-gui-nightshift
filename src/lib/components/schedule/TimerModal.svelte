<script>
  import { _ } from 'svelte-i18n'
  import Modal from '../ui/Modal.svelte'
  import Button from '../ui/Button.svelte'
  import SegmentedControl from '../ui/SegmentedControl.svelte'
  import DayPicker from './DayPicker.svelte'
  import { daysToFlags, flagsToDays, hasAnyDay, DAYS } from '../../schedule/timers.js'

  let { open = false, timer = null, busy = false, onclose = () => {}, onsave = () => {} } = $props()

  let flags = $state(DAYS.map(() => true))
  let time = $state('08:00')
  let timerState = $state('active')
  let showDayError = $state(false)

  $effect(() => {
    if (open) {
      flags = timer ? daysToFlags(timer.days) : DAYS.map(() => true)
      time = timer?.time ?? '08:00'
      timerState = timer?.state ?? 'active'
      showDayError = false
    }
  })

  let stateOptions = $derived([
    { value: 'active', label: $_('schedule.active') },
    { value: 'eco', label: $_('schedule.eco') },
    { value: 'disabled', label: $_('schedule.disabled') },
  ])

  function save() {
    if (!hasAnyDay(flags)) {
      showDayError = true
      return
    }
    onsave({ state: timerState, time, days: flagsToDays(flags) })
  }
</script>

<Modal visible={open} closable={!busy} {onclose}>
  <h2 class="mb-4 text-base font-semibold text-text">
    {timer ? $_('schedule.edit_title') : $_('schedule.new_title')}
  </h2>

  <DayPicker {flags} onchange={(f) => { flags = f; showDayError = false }} />
  {#if showDayError}
    <p class="mt-2 text-xs text-error">{$_('schedule.error_no_day')}</p>
  {/if}

  <label class="mt-4 block">
    <span class="mb-1 block text-[10px] tracking-wide text-text-dim uppercase">{$_('schedule.time')}</span>
    <input
      type="time"
      bind:value={time}
      class="block w-full min-w-0 appearance-none rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text"
    />
  </label>

  <div class="mt-4">
    <span class="mb-1 block text-[10px] tracking-wide text-text-dim uppercase">{$_('schedule.state')}</span>
    <SegmentedControl options={stateOptions} value={timerState} onchange={(v) => (timerState = v)} />
  </div>

  <div class="mt-5 flex gap-2">
    <Button label={$_('schedule.save')} disabled={busy} onclick={save} />
    <Button label={$_('schedule.cancel')} variant="ghost" disabled={busy} onclick={onclose} />
  </div>
</Modal>
