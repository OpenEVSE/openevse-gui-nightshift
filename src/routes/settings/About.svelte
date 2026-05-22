<!-- src/routes/settings/About.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import Icon from '../../lib/icons/Icon.svelte'

  const links = [
    { labelKey: 'config.about.docs', href: 'https://openevse.stoplight.io/docs/openevse-wifi-v4', icon: 'mdi:book-open-variant' },
    { labelKey: 'config.about.repo_wifi', href: 'https://github.com/OpenEVSE/ESP32_WiFi_V4.x', icon: 'mdi:github' },
    { labelKey: 'config.about.repo_evse', href: 'https://github.com/OpenEVSE/open_evse', icon: 'mdi:github' },
  ]
</script>

<ConfigPage title={$_('config.pages.about')}>
  <ConfigSection title={$_('config.about.versions')}>
    <ReadOnlyRow label={$_('config.about.firmware')} value={$config_store?.firmware} />
    <ReadOnlyRow label={$_('config.about.gateway')} value={$config_store?.version} />
  </ConfigSection>

  <ConfigSection title={$_('config.about.links')}>
    {#each links as link}
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer"
        class="flex items-center gap-3 py-2 text-sm text-text hover:text-accent"
      >
        <Icon icon={link.icon} size={18} class="text-text-dim" />
        <span class="flex-1">{$_(link.labelKey)}</span>
        <Icon icon="mdi:open-in-new" size={16} class="text-text-dim" />
      </a>
    {/each}
  </ConfigSection>

  <p class="mt-4 text-center text-xs text-text-dim">{$_('config.about.credit')}</p>
</ConfigPage>
