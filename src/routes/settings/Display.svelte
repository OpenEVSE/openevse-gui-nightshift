<!-- src/routes/settings/Display.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import SegmentedControl from '../../lib/components/ui/SegmentedControl.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  // On-device LVGL panel theme (config key `tft_theme`) — distinct from the web
  // UI's own site theme. Values mirror the GUI's [data-theme] tokens so the
  // panel and the page render the same palette. The device repaints within ~1s
  // of the /config write and persists the choice across reboot.
  let themeOptions = $derived([
    { value: 'dark', label: $_('config.display.dark') },
    { value: 'light', label: $_('config.display.light') },
  ])
  let current = $derived($config_store?.tft_theme ?? 'dark')
</script>

<ConfigPage title={$_('config.pages.display')}>
  <ConfigSection title={$_('config.display.panel')}>
    <FormField
      label={$_('config.display.theme')}
      description={$_('config.display.theme_desc')}
      status={$ss.tft_theme ?? 'idle'}
    >
      <SegmentedControl
        options={themeOptions}
        value={current}
        onchange={(v) => form.saveField('tft_theme', v)}
      />
    </FormField>
  </ConfigSection>
</ConfigPage>
