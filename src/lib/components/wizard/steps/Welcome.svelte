<!--
  src/lib/components/wizard/steps/Welcome.svelte

  Step 0: friendly intro. The "Open in browser" escape hatch only
  surfaces on mobile UAs that may have launched us inside a captive
  portal webview where the next-step buttons would otherwise dead-end.
-->
<script>
  import { _ } from 'svelte-i18n'
  import GearMark from '../../../../assets/GearMark.svelte'

  function openInBrowser() {
    const host = window.location.host
    if (/Android/i.test(navigator.userAgent)) {
      window.location.href = `intent://${host}/#/wizard#Intent;scheme=http;end`
    } else if (/iPhone|iPad/i.test(navigator.userAgent)) {
      // /success.html is served by the device's captive-portal endpoint;
      // touching it pops iOS out of the captive sheet into Safari.
      window.location.href = `http://${host}/success.html`
    }
  }

  let isMobile = $derived(
    typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad/i.test(navigator.userAgent),
  )
</script>

<div class="space-y-4 text-center">
  <GearMark class="mx-auto h-14 w-14 text-accent" />
  <div>
    <p class="text-xs uppercase tracking-wider text-text-dim">
      {$_('wizard.welcome.kicker')}
    </p>
    <h2 class="mt-1 text-xl font-semibold text-text">
      {$_('wizard.welcome.heading')}
    </h2>
  </div>
  <p class="text-sm text-text-dim">{$_('wizard.welcome.body')}</p>

  {#if isMobile}
    <div class="mt-6 rounded-xl border border-border bg-surface-2 p-3 text-left text-xs text-text-dim">
      <p class="mb-2">{$_('wizard.welcome.captive_hint')}</p>
      <button
        type="button"
        onclick={openInBrowser}
        class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-text"
      >
        {$_('wizard.welcome.open_in_browser')}
      </button>
    </div>
  {/if}
</div>
