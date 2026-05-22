// src/lib/config/tesla.js
// Whether the device config holds a usable set of Tesla API credentials.

function present(v) {
  return v !== undefined && v !== null && v !== '' && v !== false && v !== 0
}

export function hasTeslaCredentials(config) {
  if (!config) return false
  return (
    present(config.tesla_access_token) &&
    present(config.tesla_refresh_token) &&
    present(config.tesla_created_at) &&
    present(config.tesla_expires_in)
  )
}
