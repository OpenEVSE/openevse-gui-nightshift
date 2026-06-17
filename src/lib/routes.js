import Dashboard from '../routes/Dashboard.svelte'
import Schedule from '../routes/Schedule.svelte'
import Monitoring from '../routes/MonitoringLazy.svelte'
import History from '../routes/History.svelte'
import Settings from '../routes/Settings.svelte'
import NotFound from '../routes/NotFound.svelte'
import ConfigPlaceholder from './components/config/ConfigPlaceholder.svelte'
import { SETTINGS_PAGES } from './config/pages.js'
import Network from '../routes/settings/Network.svelte'
import Http from '../routes/settings/Http.svelte'
import Mqtt from '../routes/settings/Mqtt.svelte'
import Ocpp from '../routes/settings/Ocpp.svelte'
import Evse from '../routes/settings/Evse.svelte'
import Safety from '../routes/settings/Safety.svelte'
import Time from '../routes/settings/Time.svelte'
import Rfid from '../routes/settings/Rfid.svelte'
import Vehicle from '../routes/settings/Vehicle.svelte'
import Solar from '../routes/settings/Solar.svelte'
import Shaper from '../routes/settings/Shaper.svelte'
import Emoncms from '../routes/settings/Emoncms.svelte'
import Ohmconnect from '../routes/settings/Ohmconnect.svelte'
import Firmware from '../routes/settings/Firmware.svelte'
import Certificates from '../routes/settings/Certificates.svelte'
import Terminal from '../routes/settings/Terminal.svelte'
import About from '../routes/settings/About.svelte'

export const routes = {
  '/': Dashboard,
  '/schedule': Schedule,
  '/monitoring': Monitoring,
  '/history': History,
  '/settings': Settings,
}

// Every config page is a static, exact-match route. Until a themed batch
// builds a page, its route resolves to the ConfigPlaceholder.
for (const page of SETTINGS_PAGES) {
  routes[page.route] = ConfigPlaceholder
}

// Connectivity pages — override the placeholders set above.
routes['/settings/network'] = Network
routes['/settings/http'] = Http
routes['/settings/mqtt'] = Mqtt
routes['/settings/ocpp'] = Ocpp

// Charger pages — override the placeholders set above.
routes['/settings/evse'] = Evse
routes['/settings/safety'] = Safety
routes['/settings/time'] = Time
routes['/settings/rfid'] = Rfid
routes['/settings/vehicle'] = Vehicle

// Energy pages — override the placeholders set above.
routes['/settings/solar'] = Solar
routes['/settings/shaper'] = Shaper
routes['/settings/emoncms'] = Emoncms
routes['/settings/ohmconnect'] = Ohmconnect

// System pages — override the placeholders set above.
routes['/settings/firmware'] = Firmware
routes['/settings/certificates'] = Certificates
routes['/settings/terminal'] = Terminal
routes['/settings/about'] = About

// Hash routes from the previous UI mapped to their new homes, so bookmarks
// and already-open tabs land on the right page after a firmware update
// instead of a 404. Two pages were renamed; the rest moved
// /configuration/* -> /settings/*.
export const LEGACY_ROUTES = {
  '/configuration': '/settings',
  '/configuration/selfproduction': '/settings/solar',
  '/configuration/dev': '/settings/terminal',
  '/configuration/certificates': '/settings/certificates',
  // The short-lived combined "Security" page was reverted to Certificates;
  // boot lock + heartbeat moved to the Safety page.
  '/settings/security': '/settings/certificates',
}
for (const page of [
  'safety', 'evse', 'mqtt', 'http', 'ocpp', 'network', 'firmware', 'time',
  'shaper', 'vehicle', 'emoncms', 'ohmconnect', 'about',
]) {
  LEGACY_ROUTES['/configuration/' + page] = '/settings/' + page
}

export { NotFound }
