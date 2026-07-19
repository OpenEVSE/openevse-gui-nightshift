<!--
  src/lib/components/wizard/steps/Security.svelte

  First-run password nudge. Setting a password is optional (the device
  stays reachable on a trusted LAN without one), but offering it here —
  as an informed choice rather than a silent default — is what addresses
  the "open by default" finding. Leaving the fields blank and pressing
  Next is the "skip" path; nothing is written.
-->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../../stores/config.js'
  import { createConfigForm } from '../../../config/configForm.svelte.js'
  import FormField from '../../config/FormField.svelte'
  import TextInput from '../../ui/TextInput.svelte'
  import PasswordInput from '../../ui/PasswordInput.svelte'

  const form = createConfigForm()
  const ss = form.saveState
</script>

<div class="space-y-4">
  <p class="text-sm text-text-dim">{$_('wizard.security.intro')}</p>

  <FormField label={$_('config.http.username')} status={$ss.www_username ?? 'idle'}>
    <TextInput
      value={$config_store?.www_username ?? ''}
      maxlength={15}
      placeholder={$_('wizard.security.username_placeholder')}
      revert={form.revert}
      onchange={(v) => form.saveField('www_username', v)}
    />
  </FormField>

  <FormField label={$_('config.http.password')} status={$ss.www_password ?? 'idle'}>
    <PasswordInput
      value={$config_store?.www_password ?? ''}
      maxlength={15}
      revert={form.revert}
      onchange={(v) => form.saveField('www_password', v)}
    />
  </FormField>

  <p class="text-xs text-text-dim">{$_('wizard.security.skip_hint')}</p>
</div>
