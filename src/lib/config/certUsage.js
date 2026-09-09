// src/lib/config/certUsage.js
// Which stored certificate is referenced by which part of the configuration.
//
// A charger claimed by an account ends up with several certificates installed
// and no way to tell from the list which one is load-bearing. The answer is in
// the configuration, not in the certificate's name: the provisioning tool's
// naming convention is its own business and must never leak into this UI, so
// usage is keyed strictly on the config key that points at the id.

export const CERT_REFERENCES = [
  { key: 'mqtt_certificate_id', usage: 'mqtt' },
  { key: 'cloud_certificate_id', usage: 'cloud' },
]

/**
 * Every usage referencing this certificate id, in CERT_REFERENCES order.
 * Ids are compared as strings — the device reports them as strings but a
 * config value may arrive as a number.
 *
 * @returns {string[]} e.g. ['mqtt'], ['cloud'], ['mqtt', 'cloud'] or []
 */
export function certificateUsage(config, id) {
  const wanted = String(id ?? '')
  if (!config || wanted === '') return []
  return CERT_REFERENCES.filter(({ key }) => String(config[key] ?? '') === wanted).map(
    ({ usage }) => usage,
  )
}
