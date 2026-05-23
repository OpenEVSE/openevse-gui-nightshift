<!--
  src/lib/components/wizard/WizardShell.svelte

  Layout chrome for the first-run setup wizard. Pure presentational —
  the parent Wizard.svelte owns the step number and the handlers.

  Footer rules:
    - first step: only "Next" (no Previous)
    - last step:  Previous + "Finish"
    - else:       Previous + Next
-->
<script>
  import { _ } from 'svelte-i18n'
  import GearMark from '../../../assets/GearMark.svelte'
  import Button from '../ui/Button.svelte'
  import Icon from '../../icons/Icon.svelte'

  let {
    step = 0,
    total = 5,
    title = '',
    canAdvance = true,
    onPrev = () => {},
    onNext = () => {},
    onFinish = () => {},
    children,
  } = $props()

  let isFirst = $derived(step === 0)
  let isLast = $derived(step === total - 1)
</script>

<div class="flex h-full flex-col bg-surface text-text">
  <!-- Header: brand + step indicator -->
  <header
    class="flex items-center justify-between gap-3 border-b border-border px-4 py-3"
  >
    <div class="flex items-center gap-2">
      <GearMark class="h-6 w-6 text-accent" />
      <span class="text-sm font-semibold tracking-wide">OpenEVSE</span>
    </div>
    <span class="text-xs text-text-dim" data-testid="wizard-progress">
      {$_('wizard.step_count', { values: { current: step + 1, total } })}
    </span>
  </header>

  <!-- Body -->
  <main class="flex-1 overflow-y-auto px-4 py-5">
    <div class="mx-auto w-full max-w-md">
      {#if title}
        <h1 class="mb-4 text-base font-semibold text-text">{title}</h1>
      {/if}
      {@render children?.()}
    </div>
  </main>

  <!-- Progress dots -->
  <div class="flex items-center justify-center gap-1.5 px-4 pb-2">
    {#each Array(total) as _dot, i}
      <span
        class="h-1.5 rounded-full transition-all
               {i === step ? 'w-6 bg-accent' : 'w-1.5 bg-surface-3'}"
      ></span>
    {/each}
  </div>

  <!-- Footer: nav buttons -->
  <footer
    class="flex items-center gap-3 border-t border-border px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
  >
    {#if !isFirst}
      <button
        type="button"
        onclick={onPrev}
        class="flex items-center gap-1 rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-text"
      >
        <Icon icon="mdi:chevron-left" size={16} />
        {$_('wizard.previous')}
      </button>
    {/if}
    <div class="flex-1"></div>
    {#if isLast}
      <div class="min-w-[120px]">
        <Button label={$_('wizard.finish')} onclick={onFinish} disabled={!canAdvance} />
      </div>
    {:else}
      <button
        type="button"
        onclick={onNext}
        disabled={!canAdvance}
        class="flex items-center gap-1 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-surface
               disabled:cursor-not-allowed disabled:opacity-40"
      >
        {$_('wizard.next')}
        <Icon icon="mdi:chevron-right" size={16} />
      </button>
    {/if}
  </footer>
</div>
