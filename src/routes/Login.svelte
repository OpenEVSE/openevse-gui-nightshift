<!--
  src/routes/Login.svelte

  Standalone full-screen login. App.svelte renders this (bypassing the
  normal load/wizard/shell flow) whenever the hash route is /login, which
  the httpAPI 401 interceptor sets when a session is missing or expired.

  Posts to /login with a bare fetch (not httpAPI) so the interceptor never
  fires on the login request itself. On success the firmware sets the
  session cookie and we return to the dashboard, where the normal data
  fetch retries — now authenticated.
-->
<script>
  import { _ } from 'svelte-i18n'
  import { redirect } from '../lib/router.js'
  import Card from '../lib/components/ui/Card.svelte'
  import TextInput from '../lib/components/ui/TextInput.svelte'
  import PasswordInput from '../lib/components/ui/PasswordInput.svelte'
  import Toggle from '../lib/components/ui/Toggle.svelte'
  import Button from '../lib/components/ui/Button.svelte'

  let user = $state('')
  let pass = $state('')
  let remember = $state(false)
  let error = $state('')
  let busy = $state(false)

  async function submit() {
    if (busy) return
    busy = true
    error = ''
    try {
      const url = (import.meta.env.DEV ? '/api' : '') + '/login'
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'OpenEVSE',
        },
        body: JSON.stringify({ user, pass, remember }),
      })
      if (r.ok) {
        redirect('/')
      } else if (r.status === 429) {
        error = $_('login.locked')
      } else {
        error = $_('login.invalid')
      }
    } catch {
      error = $_('login.error')
    } finally {
      busy = false
    }
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-bg p-4">
  <Card class="w-full max-w-sm p-6">
    <h1 class="mb-1 text-center text-xl font-semibold text-text">
      {$_('login.title')}
    </h1>
    <p class="mb-5 text-center text-sm text-text-dim">{$_('login.subtitle')}</p>

    <form
      onsubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      class="flex flex-col gap-3"
    >
      <label class="text-sm text-text-dim" for="login-user">
        {$_('login.username')}
      </label>
      <TextInput
        value={user}
        placeholder={$_('login.username')}
        onchange={(v) => (user = v)}
      />

      <label class="text-sm text-text-dim" for="login-pass">
        {$_('login.password')}
      </label>
      <PasswordInput value={pass} onchange={(v) => (pass = v)} />

      <label class="mt-1 flex items-center gap-2 text-sm text-text">
        <Toggle
          checked={remember}
          label={$_('login.remember')}
          onchange={(v) => (remember = v)}
        />
        {$_('login.remember')}
      </label>

      {#if error}
        <p class="text-sm text-red-400" role="alert">{error}</p>
      {/if}

      <div class="mt-2">
        <Button
          type="submit"
          label={$_('login.submit')}
          disabled={busy}
          onclick={submit}
        />
      </div>
    </form>
  </Card>
</div>
