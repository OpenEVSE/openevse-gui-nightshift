<!--
  src/lib/components/config/CredentialFields.svelte

  Username + password as an ATOMIC pair. Both are written in a single /config
  POST on an explicit Save — never per field on blur — because two separate
  writes are unsafe here:

   - A partially-typed password would autosave on blur (you get locked out with a
     truncated password you don't know).
   - On an open device the password write flips auth ON; a following username
     write then hits the now-enabled auth with no session and 401s, so the
     username silently never lands (the "I set admin but openevseadmin is what
     works" bug).

  One POST while the device is still open sets both, and auth flips on after —
  no orphaned second write. A username is required whenever a password is set,
  so there's no silent `openevseadmin` default to guess.
-->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../stores/config.js'
  import { createConfigForm } from '../../config/configForm.svelte.js'
  import FormField from './FormField.svelte'
  import TextInput from '../ui/TextInput.svelte'
  import PasswordInput from '../ui/PasswordInput.svelte'
  import Button from '../ui/Button.svelte'

  let { onsaved = () => {} } = $props()

  const form = createConfigForm()

  // Local drafts. Username seeds from the stored value so an existing username
  // is shown; the password never seeds (it's a secret) and must be re-entered.
  let user = $state($config_store?.www_username ?? '')
  let pass = $state('')
  let saving = $state(false)
  let saved = $state(false)

  let missingUser = $derived(pass.trim() !== '' && user.trim() === '')

  async function save() {
    if (saving) return
    // Inputs commit on blur; commit whatever's focused before we read the drafts.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    const u = user.trim()
    const p = pass.trim()
    if (p === '' || u === '') return // nothing to set / username still required
    saving = true
    saved = false
    const ok = await form.saveFields({ www_username: u, www_password: p })
    saving = false
    if (ok) {
      saved = true
      pass = '' // don't keep the secret sitting in the field
      onsaved()
    }
  }
</script>

<div class="space-y-3">
  <FormField label={$_('config.http.username')}>
    <TextInput
      value={user}
      maxlength={15}
      placeholder={$_('config.http.username')}
      onchange={(v) => (user = v)}
    />
  </FormField>

  <FormField label={$_('config.http.password')}>
    <PasswordInput
      value={pass}
      maxlength={15}
      placeholder={$_('config.http.password')}
      onchange={(v) => (pass = v)}
    />
  </FormField>

  {#if missingUser}
    <p class="text-sm text-error">{$_('config.http.username_required')}</p>
  {/if}
  {#if saved}
    <p class="text-sm text-text-dim">{$_('config.http.creds_saved')}</p>
  {/if}

  <Button
    label={$_('config.http.set_credentials')}
    onclick={save}
    disabled={saving}
  />
</div>
