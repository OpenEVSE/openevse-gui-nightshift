<script>
  // Boost: forces a charging session for a preset duration. The button has
  // two states:
  //   - idle: a plain "Boost" button that opens the preset modal
  //   - active: an inline countdown ("Boosting · MM:SS") with a Cancel button
  //
  // The parent owns the timer and the device interactions; this component
  // only displays state and emits onboost / oncancel.
  import { _ } from 'svelte-i18n'
  import Button from '../ui/Button.svelte'
  import Modal from '../ui/Modal.svelte'

  let {
    disabled = false,
    endsAt = null,        // ms epoch when current boost ends, or null
    onboost = () => {},
    oncancel = () => {},
  } = $props()

  let open = $state(false)
  let now = $state(Date.now())
  // 1Hz tick — only runs while a boost is active so we don't burn cycles.
  $effect(() => {
    if (!endsAt) return
    const id = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(id)
  })

  let remainingMs = $derived(endsAt ? Math.max(0, endsAt - now) : 0)
  let remainingText = $derived(formatRemaining(remainingMs))
  let active = $derived(!!endsAt && remainingMs > 0)

  function formatRemaining(ms) {
    const total = Math.ceil(ms / 1000)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const PRESETS = [
    { minutes: 15, key: 'minutes', n: 15 },
    { minutes: 30, key: 'minutes', n: 30 },
    { minutes: 60, key: 'hour' },
  ]

  function pickPreset(minutes) {
    open = false
    onboost(minutes)
  }
</script>

<div class="mt-3">
  {#if active}
    <div class="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm font-semibold text-accent">
          {$_('dashboard.boost.active', { values: { time: remainingText } })}
        </span>
        <div class="shrink-0">
          <Button
            label={$_('dashboard.boost.cancel_active')}
            variant="ghost"
            onclick={oncancel}
          />
        </div>
      </div>
    </div>
  {:else}
    <Button
      label={$_('dashboard.boost.label')}
      variant="ghost"
      {disabled}
      onclick={() => (open = true)}
    />
  {/if}
</div>

<Modal visible={open} closable={true} onclose={() => (open = false)}>
  <h2 class="mb-2 text-base font-semibold text-text">{$_('dashboard.boost.title')}</h2>
  <p class="mb-4 text-sm text-text-dim">{$_('dashboard.boost.body')}</p>
  <div class="grid grid-cols-3 gap-2">
    {#each PRESETS as p}
      <Button
        label={p.key === 'hour' ? $_('dashboard.boost.hour') : $_('dashboard.boost.minutes', { values: { n: p.n } })}
        onclick={() => pickPreset(p.minutes)}
      />
    {/each}
  </div>
  <div class="mt-4">
    <Button label={$_('dashboard.boost.cancel')} variant="ghost" onclick={() => (open = false)} />
  </div>
</Modal>
