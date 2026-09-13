// src/lib/cabletemp.js
// Pure helpers for cable-temperature-monitoring (NTC thermistors in the EV/
// input cables, RAPI $SN/$GN). No store/DOM/i18n imports — see
// src/lib/stores/cabletemp.js for the /cabletemp GET/POST wrapper and
// src/lib/config/cableTempForm.svelte.js for the write orchestration.
//
// The GUI is pin-centric (2 physical inputs, each picks one of 4 logical
// sources or None) even though the wire protocol is source-centric (each of
// the 4 sources independently picks a pin) — see openevse_esp32_firmware's
// docs/rapi.md $SN entry for why only 2 of the 4 sources can be active at
// once, and the PP_READ/PP-auto-ampacity pin-sharing note.

export const CABLE_TEMP_PIN_NONE = 0
export const CABLE_TEMP_PIN_PP = 1
export const CABLE_TEMP_PIN_PP2 = 2

// Source order matches OPENEVSE_CABLE_TEMP_SOURCE_* / the /cabletemp
// response: EV1, EV2 (EV/output cable), IN1, IN2 (input/supply cable).
export const CABLE_TEMP_SOURCE_NAMES = ['ev1', 'ev2', 'in1', 'in2']

export const CABLE_TEMP_STATUS_OK = 0
export const CABLE_TEMP_STATUS_NOT_INSTALLED = 1
export const CABLE_TEMP_STATUS_OPEN = 2
export const CABLE_TEMP_STATUS_SHORTED = 3

const STATUS_I18N_SUFFIX = { 1: 'not_installed', 2: 'open', 3: 'shorted' }

/** i18n key suffix ('not_installed'|'open'|'shorted') for a non-OK status; null when OK (0). */
export function cableTempStatusKey(status) {
  return STATUS_I18N_SUFFIX[status] ?? null
}

/** The source object (from /cabletemp's `sources` array) wired to `pin`, or null. */
export function cableTempSourceOnPin(cabletemp, pin) {
  return cabletemp?.sources?.find((s) => s.pin === pin) ?? null
}

/** The source object at logical index `index` (0-3), or null. */
export function cableTempSourceByIndex(cabletemp, index) {
  return cabletemp?.sources?.find((s) => s.source === index) ?? null
}

/**
 * Dropdown options for one physical input: None + the 4 logical sources,
 * with whichever source is already wired to the *other* physical input
 * disabled. The firmware itself doesn't enforce one-source-per-pin (two
 * sources can share an input), but presenting that as a normal choice here
 * would just be confusing, so the GUI keeps the two inputs mutually
 * exclusive. `none`/`labelFor` are passed in so this stays i18n-free.
 */
export function cableTempSourceOptions(cabletemp, pin, otherPin, none, labelFor) {
  const usedByOther = cableTempSourceOnPin(cabletemp, otherPin)?.source
  return [
    { value: '', label: none },
    ...CABLE_TEMP_SOURCE_NAMES.map((name, i) => ({
      value: String(i),
      label: labelFor(name),
      disabled: i === usedByOther,
    })),
  ]
}

/** Tenths-of-°C (offset_c10/panic_c10 wire format) -> °C, or null. */
export function c10ToC(c10) {
  return typeof c10 === 'number' && Number.isFinite(c10) ? c10 / 10 : null
}

/** °C -> tenths-of-°C (offset_c10/panic_c10 wire format), or null. */
export function cToC10(c) {
  return typeof c === 'number' && Number.isFinite(c) ? Math.round(c * 10) : null
}

/** Whether any Cable Temperature Monitoring source is assigned to a pin. */
export function cableTempHasAssignedSource(cabletemp) {
  return !!cabletemp?.sources?.some((s) => s.pin !== CABLE_TEMP_PIN_NONE)
}
