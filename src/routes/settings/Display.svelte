<!-- src/routes/settings/Display.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { createConfigForm } from '../../lib/config/configForm.svelte.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import SegmentedControl from '../../lib/components/ui/SegmentedControl.svelte'
  import Slider from '../../lib/components/ui/Slider.svelte'
  import Toggle from '../../lib/components/ui/Toggle.svelte'

  const form = createConfigForm()
  const ss = form.saveState

  // Every control here maps to an LVGL-TFT firmware config key. The firmware
  // only emits a key in GET /config when it supports it, so each control is
  // gated on the key being *present* (`in`), not truthy — `tft_standby_brightness`
  // and `lcd_backlight_timeout` are validly 0 (backlight off / never sleep) and a
  // truthiness gate would wrongly hide those configurations.
  let cfg = $derived($config_store ?? {})
  let hasBrightness = $derived('tft_brightness' in cfg)
  let hasStandby = $derived('tft_standby_brightness' in cfg)
  let hasTimeout = $derived('lcd_backlight_timeout' in cfg)

  // On-device LVGL panel theme (config key `tft_theme`) — distinct from the web
  // UI's own site theme. Values mirror the GUI's [data-theme] tokens so the
  // panel and the page render the same palette. All writes apply live (~1s); no
  // reboot.
  let themeOptions = $derived([
    { value: 'dark', label: $_('config.display.dark') },
    { value: 'light', label: $_('config.display.light') },
  ])
  let theme = $derived(cfg.tft_theme ?? 'dark')

  // Brightness, percent. Active has a 10% firmware floor; standby allows 0 to
  // blank the backlight on idle.
  let brightness = $derived(cfg.tft_brightness ?? 100)
  let standby = $derived(cfg.tft_standby_brightness ?? 15)
  let pct = (v) => `${v}%`
  let standbyFmt = (v) => (v === 0 ? $_('config.display.standby_off') : `${v}%`)

  // Idle timeout, seconds. 0 = never sleep (Never toggle). The slider works in
  // 5–3600s; we remember the last non-zero value so toggling Never off restores
  // a sensible position rather than snapping to the floor.
  let timeout = $derived(cfg.lcd_backlight_timeout ?? 600)
  let never = $derived(timeout === 0)
  let lastSecs = $state(600)
  $effect(() => {
    if (timeout > 0) lastSecs = timeout
  })
  let sliderSecs = $derived(never ? lastSecs : timeout)

  function fmtTimeout(secs) {
    if (secs <= 0) return $_('config.display.never')
    if (secs % 3600 === 0) return `${secs / 3600}h`
    if (secs % 60 === 0) return `${secs / 60}m`
    return `${secs}s`
  }

  function setNever(on) {
    form.saveField('lcd_backlight_timeout', on ? 0 : lastSecs)
  }
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
        value={theme}
        onchange={(v) => form.saveField('tft_theme', v)}
      />
    </FormField>

    {#if hasBrightness}
      <FormField
        label={$_('config.display.brightness')}
        description={$_('config.display.brightness_desc')}
        status={$ss.tft_brightness ?? 'idle'}
      >
        <Slider
          min={10}
          max={100}
          step={5}
          value={brightness}
          format={pct}
          ariaLabel={$_('config.display.brightness')}
          onchange={(v) => form.saveField('tft_brightness', v)}
        />
      </FormField>
    {/if}

    {#if hasStandby}
      <FormField
        label={$_('config.display.standby')}
        description={$_('config.display.standby_desc')}
        status={$ss.tft_standby_brightness ?? 'idle'}
      >
        <Slider
          min={0}
          max={100}
          step={5}
          value={standby}
          format={standbyFmt}
          ariaLabel={$_('config.display.standby')}
          onchange={(v) => form.saveField('tft_standby_brightness', v)}
        />
      </FormField>
    {/if}

    {#if hasTimeout}
      <FormField
        label={$_('config.display.timeout')}
        description={$_('config.display.timeout_desc')}
        status={$ss.lcd_backlight_timeout ?? 'idle'}
      >
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs text-text-dim">{fmtTimeout(sliderSecs)}</span>
          <label class="flex items-center gap-2 text-xs text-text-dim">
            {$_('config.display.never')}
            <Toggle
              checked={never}
              label={$_('config.display.never')}
              onchange={setNever}
            />
          </label>
        </div>
        <Slider
          min={5}
          max={3600}
          step={5}
          value={sliderSecs}
          disabled={never}
          format={fmtTimeout}
          ariaLabel={$_('config.display.timeout')}
          onchange={(v) => form.saveField('lcd_backlight_timeout', v)}
        />
      </FormField>
    {/if}
  </ConfigSection>
</ConfigPage>
