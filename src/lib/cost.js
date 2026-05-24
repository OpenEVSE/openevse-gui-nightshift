// Local-only session cost helper. The device doesn't know the user's tariff;
// uisettings_store.energy_rate / currency_symbol hold it (set on Settings →
// HTTP). When rate is 0 callers treat the helper as "no cost to display".

/**
 * Format an energy reading as a localised cost string.
 * @param {number} kWh Session energy in kilowatt-hours.
 * @param {number} rate Tariff per kWh in the user's currency.
 * @param {string} symbol Currency symbol — prefixed verbatim, no spacing.
 * @returns {string|null} `null` when rate/kWh aren't usable for a cost.
 */
export function formatCost(kWh, rate, symbol) {
  if (!Number.isFinite(kWh) || !Number.isFinite(rate) || rate <= 0 || kWh < 0) {
    return null
  }
  const value = kWh * rate
  // Two decimal places matches how people write tariffs (e.g. "$0.42/kWh");
  // toFixed(2) is good enough — the kWh source itself is only Wh-resolution.
  return `${symbol ?? ''}${value.toFixed(2)}`
}
