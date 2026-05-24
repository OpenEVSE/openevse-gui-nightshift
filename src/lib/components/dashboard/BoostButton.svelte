<script>
  // Boost: forces a charging session for a preset duration and lets the
  // device auto-stop when the time runs out.
  //
  // Implementation: post an override of {state: 'active', charge_current:
  // max} (so charging starts immediately even from Off / Auto-waiting) and
  // a time limit with auto_release: true (so the limit claim disappears
  // when the timer expires). The override stays in 'active' afterward —
  // the user can flip the mode back manually. Good enough for v1; the
  // tradeoff is documented.
  import { _ } from 'svelte-i18n'
  import Button from '../ui/Button.svelte'
  import Modal from '../ui/Modal.svelte'

  let { disabled = false, onboost = () => {} } = $props()

  let open = $state(false)

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
  <Button
    label={$_('dashboard.boost.label')}
    variant="ghost"
    {disabled}
    onclick={() => (open = true)}
  />
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
