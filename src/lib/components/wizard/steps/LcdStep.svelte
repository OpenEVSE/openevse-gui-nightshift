<!--
  src/lib/components/wizard/steps/LcdStep.svelte

  Remote-display builds only: the panel's own LCD settings. Maps 1:1 onto
  the firmware's LVGL TFT config options — theme, active/standby brightness
  and the idle timeout before the standby screen (0 = never dim).
-->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../../stores/config.js'
  import { createConfigForm } from '../../../config/configForm.svelte.js'
  import FormField from '../../config/FormField.svelte'
  import Select from '../../ui/Select.svelte'
  import Slider from '../../ui/Slider.svelte'
  import NumberInput from '../../ui/NumberInput.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  const themeOptions = $derived([
    { value: 'dark', label: $_('wizard.lcd.theme_dark') },
    { value: 'light', label: $_('wizard.lcd.theme_light') },
  ])
</script>

<div class="space-y-4">
  <p class="text-sm text-text-dim">{$_('wizard.lcd.intro')}</p>

  <FormField label={$_('wizard.lcd.theme')} status={$ss.tft_theme ?? 'idle'}>
    <Select
      options={themeOptions}
      value={$config_store?.tft_theme ?? 'dark'}
      onchange={(v) => form.saveField('tft_theme', v)}
    />
  </FormField>

  <FormField label={$_('wizard.lcd.brightness')} status={$ss.tft_brightness ?? 'idle'}>
    <Slider
      min={10}
      max={100}
      step={5}
      value={$config_store?.tft_brightness ?? 100}
      format={(v) => `${v}%`}
      ariaLabel={$_('wizard.lcd.brightness')}
      onchange={(v) => form.saveField('tft_brightness', v)}
    />
  </FormField>

  <FormField
    label={$_('wizard.lcd.standby_brightness')}
    status={$ss.tft_standby_brightness ?? 'idle'}
    description={$_('wizard.lcd.standby_hint')}
  >
    <Slider
      min={0}
      max={100}
      step={5}
      value={$config_store?.tft_standby_brightness ?? 15}
      format={(v) => `${v}%`}
      ariaLabel={$_('wizard.lcd.standby_brightness')}
      onchange={(v) => form.saveField('tft_standby_brightness', v)}
    />
  </FormField>

  <FormField
    label={$_('wizard.lcd.timeout')}
    status={$ss.lcd_backlight_timeout ?? 'idle'}
    description={$_('wizard.lcd.timeout_hint')}
  >
    <NumberInput
      min={0}
      max={86400}
      value={$config_store?.lcd_backlight_timeout ?? 600}
      onchange={(v) => form.saveField('lcd_backlight_timeout', v)}
    />
  </FormField>
</div>
