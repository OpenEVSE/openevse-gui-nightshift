<!-- src/lib/components/config/ConfigPlaceholder.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { currentPath } from '../../router.js'
  import { SETTINGS_PAGES } from '../../config/pages.js'
  import ConfigPage from './ConfigPage.svelte'

  let page = $derived(SETTINGS_PAGES.find((p) => p.route === $currentPath))
  let title = $derived(page ? $_(page.labelKey) : $_('config.title'))
</script>

<ConfigPage {title}>
  <p class="text-sm text-text-dim">{$_('config.coming_soon')}</p>
</ConfigPage>
