<!-- src/routes/settings/About.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { uisettings_store } from '../../lib/stores/uisettings.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import SegmentedControl from '../../lib/components/ui/SegmentedControl.svelte'
  import Icon from '../../lib/icons/Icon.svelte'

  const links = [
    { labelKey: 'config.about.docs', href: 'https://openevse.stoplight.io/docs/openevse-wifi-v4', icon: 'mdi:book-open-variant' },
    { labelKey: 'config.about.repo_wifi', href: 'https://github.com/OpenEVSE/ESP32_WiFi_V4.x', icon: 'mdi:github' },
    { labelKey: 'config.about.repo_evse', href: 'https://github.com/OpenEVSE/open_evse', icon: 'mdi:github' },
  ]

  let tempUnitOptions = $derived([
    { value: 'c', label: $_('config.about.temp_celsius') },
    { value: 'f', label: $_('config.about.temp_fahrenheit') },
  ])

  function setTempUnit(unit) {
    uisettings_store.update((s) => ({ ...s, temp_unit: unit }))
  }
</script>

<ConfigPage title={$_('config.pages.about')}>
  <ConfigSection title={$_('config.about.versions')}>
    <ReadOnlyRow label={$_('config.about.firmware')} value={$config_store?.firmware} />
    <ReadOnlyRow label={$_('config.about.gateway')} value={$config_store?.version} />
  </ConfigSection>

  <ConfigSection title={$_('config.about.preferences')}>
    <FormField label={$_('config.about.temp_unit')}>
      <SegmentedControl
        options={tempUnitOptions}
        value={$uisettings_store?.temp_unit ?? 'c'}
        onchange={setTempUnit}
      />
    </FormField>
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
  <p class="mt-1 text-center text-xs text-text-dim">
    <a
      href="https://github.com/RAR/openevse-gui-nightshift"
      target="_blank"
      rel="noreferrer"
      class="hover:text-accent hover:underline"
    >
      {$_('config.about.theme_by')}
    </a>
  </p>
</ConfigPage>
