// Charge-mode control helpers. Pure — no stores, no i18n, no DOM.
//
// mode: uistates_store.mode — 0=Auto, 1=On (override active), 2=Off (override disabled).
// divertmode: status_store.divertmode — 2 when Eco/divert is active, else 1.
// divertEnabled: !!config_store.divert_enabled — whether solar/divert is configured on the device.

// Segment keys in display order. Eco only appears when divert is enabled in config,
// so non-solar setups get a three-segment control.
export function controlSegments(divertEnabled) {
  return divertEnabled ? ['off', 'auto', 'eco', 'on'] : ['off', 'auto', 'on']
}

// Which segment is currently selected, derived from device state.
export function selectedSegment({ mode, divertmode, divertEnabled } = {}) {
  if (mode === 1) return 'on'
  if (mode === 2) return 'off'
  // Auto: Eco only when divert is both enabled and active.
  if (divertEnabled && divertmode === 2) return 'eco'
  return 'auto'
}
