import Dashboard from '../routes/Dashboard.svelte'
import Schedule from '../routes/Schedule.svelte'
import Monitoring from '../routes/Monitoring.svelte'
import History from '../routes/History.svelte'
import Settings from '../routes/Settings.svelte'
import NotFound from '../routes/NotFound.svelte'
import ConfigPlaceholder from './components/config/ConfigPlaceholder.svelte'
import { SETTINGS_PAGES } from './config/pages.js'

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

export { NotFound }
