<!-- src/lib/components/notifications/AdvisoryMarker.svelte -->
<script>
  // The inline marker that sits beside the very switch an advisory is about.
  //
  // This is the surface the whole feature exists for: "ground check is off" is
  // only actionable if it is one tap from the control that fixes it. It is
  // deliberately NOT suppressed when the advisory is muted — acking silences
  // the alarm, it never hides the state, so the owner who muted this still
  // sees it here and the charger's configuration is never secret.
  //
  // Text, not a glyph: the app's controls carry words, and "Critical" beside a
  // switch says more than a symbol the reader has to decode.
  import { _ } from 'svelte-i18n'

  let { marker = null } = $props()

  // Amber for warning, red only for critical — the firmware reserves red for
  // the fault screen, and keeping the web UI close to the LCD's palette keeps
  // the two tiers legible as different things.
  const TONE = {
    critical: 'bg-error/15 text-error',
    warning: 'bg-warning/15 text-warning',
    info: 'bg-surface-3 text-text-dim',
  }
</script>

{#if marker}
  <span class="flex shrink-0 items-center gap-1.5">
    <span
      class="rounded px-2 py-0.5 text-xs font-semibold {TONE[marker.severity] ?? TONE.info}"
      title={$_('notifications.detail.' + marker.id)}
    >
      {$_('notifications.severity.' + marker.severity)}
    </span>
    {#if marker.acked}
      <span class="rounded bg-surface-3 px-2 py-0.5 text-xs text-text-dim">
        {$_('notifications.muted')}
      </span>
    {/if}
  </span>
{/if}
