import { get } from 'svelte/store'
import { _ } from 'svelte-i18n'
import { uistates_store } from './stores/uistates.js'

/**
 * Surface the global AlertBox for a failed device write.
 * Shared by every screen so the write-failure experience is identical.
 */
export function showWriteError() {
  const t = get(_)
  uistates_store.setObject('alertbox', {
    title: t('alert.write_failed_title'),
    body: t('alert.write_failed_body'),
    visible: true,
    button: true,
    closable: true,
    component: undefined,
    action: () => uistates_store.resetAlertBox(),
  })
}

/**
 * Surface the AlertBox for a rejected Boost arm. The device speaks English in
 * its `msg`; we translate the one case the UI can provoke (soc/range with no
 * vehicle data source — a 422) and fall back to the generic write-failure body
 * for anything else (e.g. a 400 from a value the client should have caught).
 */
export function showBoostError(msg) {
  const t = get(_)
  const noSource = typeof msg === 'string' && msg.includes('vehicle data source')
  uistates_store.setObject('alertbox', {
    title: t('alert.write_failed_title'),
    body: noSource ? t('dashboard.boost.no_vehicle_source') : t('alert.write_failed_body'),
    visible: true,
    button: true,
    closable: true,
    component: undefined,
    action: () => uistates_store.resetAlertBox(),
  })
}
