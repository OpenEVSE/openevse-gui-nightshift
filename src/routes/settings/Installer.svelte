<!-- src/routes/settings/Installer.svelte -->
<script>
  // Installer Tools: commissioning controls an installer sets once and an
  // owner should not casually change — the one-time hardware current limit and
  // the safety-check switches. NEC 625.42 allows an adjustable EVSE to be sized
  // to its set current only when access to the adjustment is restricted (tool,
  // lock, or password-protected commissioning software), so the page sits
  // behind an installer password.
  //
  // The password lives on the charger and is never sent here, so every check
  // is made by the charger (POST /installer/*). It is held in memory only for
  // the life of the page: leaving it locks it again.
  import { _ } from 'svelte-i18n'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import { config_store } from '../../lib/stores/config.js'
  import { serialQueue } from '../../lib/queue.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import SafetyChecksCard from '../../lib/components/config/SafetyChecksCard.svelte'
  import Button from '../../lib/components/ui/Button.svelte'
  import Modal from '../../lib/components/ui/Modal.svelte'
  import NumberInput from '../../lib/components/ui/NumberInput.svelte'
  import PasswordInput from '../../lib/components/ui/PasswordInput.svelte'

  // Controller range for $SC amps M (J1772 minimum, 80 A maximum).
  const MIN_AMPS = 6
  const MAX_AMPS = 80
  // Same bounds the charger enforces on a new installer password.
  const MIN_PW = 4
  const MAX_PW = 32

  let unlocked = $state(false)
  let password = $state('') // verified password, kept for the actions below
  let entry = $state('')
  let busy = $state(false)
  let lockError = $state('')

  // POST to an /installer endpoint. Resolves { status, body }, or null when the
  // charger could not be reached (httpAPI maps network failures to 'error').
  async function post(path, payload) {
    const res = await serialQueue.add(() =>
      httpAPI('POST', path, JSON.stringify(payload), 'json', 60000, { raw: true }))
    return !res || res === 'error' ? null : res
  }

  // Wording for a refused password, shared by every action that sends one.
  function passwordError(res) {
    if (!res) return $_('config.installer.unreachable')
    if (res.status === 429) {
      return $_('config.installer.locked', { values: { sec: res.body?.retry_after ?? 30 } })
    }
    if (res.status === 403) return $_('config.installer.wrong')
    return $_('config.installer.unreachable')
  }

  async function unlock() {
    if (busy) return
    busy = true
    lockError = ''
    try {
      const res = await post('/installer/verify', { password: entry })
      if (res?.status === 200) {
        password = entry
        unlocked = true
      } else {
        lockError = passwordError(res)
      }
      entry = ''
    } finally {
      busy = false
    }
  }

  function lock() {
    unlocked = false
    password = ''
    maxResult = null
    pwResult = null
  }

  // ── Hardware maximum current ────────────────────────────────────────────
  let hardMax = $derived($config_store?.max_current_hard)
  let amps = $state(null)
  let pendingSet = $state(false) // confirmation dialog open
  let setting = $state(false)
  let maxResult = $state(null) // { kind: 'applied' | 'unchanged' | 'error', text }

  // Start the field on what the charger reports so the first thing an
  // installer sees is the current value, not a blank.
  $effect(() => {
    if (amps === null && typeof hardMax === 'number' && hardMax >= MIN_AMPS) amps = hardMax
  })

  // The limit can only come down: the charger refuses anything above what the
  // controller reports now, since writing a higher value would quietly spend
  // the one-time write on the old one.
  let ampsMax = $derived(
    typeof hardMax === 'number' && hardMax >= MIN_AMPS ? Math.min(hardMax, MAX_AMPS) : MAX_AMPS,
  )
  let ampsValid = $derived(Number.isInteger(amps) && amps >= MIN_AMPS && amps <= ampsMax)

  async function setHardMax() {
    pendingSet = false
    if (setting || !ampsValid) return
    setting = true
    maxResult = null
    const requested = amps
    try {
      const res = await post('/installer/maxcurrent', { password, amps: requested })
      if (res?.status === 400) {
        maxResult = {
          kind: 'error',
          text: $_('config.installer.maxcurrent_out_of_range', { values: { min: MIN_AMPS, max: ampsMax } }),
        }
        return
      }
      if (res?.status !== 200) {
        maxResult = { kind: 'error', text: passwordError(res) }
        return
      }
      // The charger only says it sent the command: the controller accepts it
      // once and answers $NK to any later attempt. Give the RAPI round trip a
      // moment, then read the limit back to see what actually took.
      await new Promise((r) => setTimeout(r, 2000))
      await config_store.download()
      maxResult = $config_store?.max_current_hard === requested
        ? { kind: 'applied', text: $_('config.installer.maxcurrent_applied', { values: { amps: requested } }) }
        : { kind: 'unchanged', text: $_('config.installer.maxcurrent_unchanged') }
    } finally {
      setting = false
    }
  }

  // ── Change installer password ───────────────────────────────────────────
  let pwCurrent = $state('')
  let pwNew = $state('')
  let pwConfirm = $state('')
  let pwBusy = $state(false)
  let pwResult = $state(null) // { kind: 'ok' | 'error', text }
  let pwRevert = $state(0) // bumped to clear the three fields

  let pwNewValid = $derived(
    pwNew.length >= MIN_PW && pwNew.length <= MAX_PW && /^[\x20-\x7e]+$/.test(pwNew),
  )

  async function changePassword() {
    if (pwBusy) return
    pwResult = null
    if (!pwNewValid) {
      pwResult = { kind: 'error', text: $_('config.installer.password_invalid', { values: { min: MIN_PW, max: MAX_PW } }) }
      return
    }
    if (pwNew !== pwConfirm) {
      pwResult = { kind: 'error', text: $_('config.installer.password_mismatch') }
      return
    }
    pwBusy = true
    try {
      const res = await post('/installer/password', { current: pwCurrent, new: pwNew })
      if (res?.status === 200) {
        password = pwNew
        pwResult = { kind: 'ok', text: $_('config.installer.password_done') }
        pwCurrent = pwNew = pwConfirm = ''
        pwRevert += 1
      } else if (res?.status === 400) {
        pwResult = { kind: 'error', text: $_('config.installer.password_invalid', { values: { min: MIN_PW, max: MAX_PW } }) }
      } else {
        pwResult = { kind: 'error', text: passwordError(res) }
      }
    } finally {
      pwBusy = false
    }
  }
</script>

<ConfigPage title={$_('config.pages.installer')}>
  {#if !unlocked}
    <ConfigSection title={$_('config.installer.lock_title')}>
      <p class="mb-3 text-sm text-text-dim">{$_('config.installer.lock_desc')}</p>
      <form
        onsubmit={(e) => {
          e.preventDefault()
          // PasswordInput commits on blur, so blur first or Enter can submit
          // before the last keystrokes register.
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
          unlock()
        }}
        class="flex flex-col gap-3"
      >
        <PasswordInput
          value={entry}
          placeholder={$_('config.installer.password')}
          onchange={(v) => (entry = v)}
        />
        {#if lockError}
          <p class="text-sm text-error" role="alert">{lockError}</p>
        {/if}
        <!-- No onclick: Enter makes the browser click this button while the
             field still has focus, before it has committed its value. The
             form's submit handler blurs first and is the only caller. -->
        <Button type="submit" label={$_('config.installer.unlock')} disabled={busy} />
      </form>
    </ConfigSection>
  {:else}
    <ConfigSection title={$_('config.installer.maxcurrent_title')}>
      <ReadOnlyRow
        label={$_('config.installer.maxcurrent_current')}
        value={hardMax != null ? `${hardMax} A` : ''}
      />

      <!-- The one-time warning sits above the control, in warning colours,
           because it is what the installer must read before touching it. -->
      <div class="mt-3 mb-3 rounded-xl border border-warning/40 bg-warning/5 p-3" role="note">
        <p class="mb-1 text-sm font-medium text-text">{$_('config.installer.maxcurrent_note_title')}</p>
        <p class="text-sm text-text-dim">{$_('config.installer.maxcurrent_note')}</p>
        <p class="mt-2 text-xs text-text-dim">{$_('config.installer.maxcurrent_note_nec')}</p>
      </div>

      <FormField label={$_('config.installer.maxcurrent_input')}>
        <NumberInput
          value={amps}
          min={MIN_AMPS}
          max={ampsMax}
          step={1}
          disabled={setting}
          onchange={(v) => (amps = v)}
        />
      </FormField>
      <Button
        label={setting ? $_('config.installer.maxcurrent_sending') : $_('config.installer.maxcurrent_set')}
        disabled={setting || !ampsValid}
        onclick={() => (pendingSet = true)}
      />
      {#if maxResult}
        <p
          class="mt-2 text-sm {maxResult.kind === 'applied' ? 'text-text-dim' : maxResult.kind === 'unchanged' ? 'text-warning' : 'text-error'}"
          role="status"
        >{maxResult.text}</p>
      {/if}
    </ConfigSection>

    <SafetyChecksCard />

    <ConfigSection title={$_('config.installer.password_title')}>
      <p class="mb-2 text-sm text-text-dim">{$_('config.installer.password_desc')}</p>
      <FormField label={$_('config.installer.password_current')}>
        <PasswordInput value={pwCurrent} revert={pwRevert} maxlength={MAX_PW} onchange={(v) => (pwCurrent = v)} />
      </FormField>
      <FormField label={$_('config.installer.password_new')}>
        <PasswordInput value={pwNew} revert={pwRevert} maxlength={MAX_PW} onchange={(v) => (pwNew = v)} />
      </FormField>
      <FormField label={$_('config.installer.password_confirm')}>
        <PasswordInput value={pwConfirm} revert={pwRevert} maxlength={MAX_PW} onchange={(v) => (pwConfirm = v)} />
      </FormField>
      <Button label={$_('config.installer.password_change')} disabled={pwBusy} onclick={changePassword} />
      {#if pwResult}
        <p class="mt-2 text-sm {pwResult.kind === 'ok' ? 'text-text-dim' : 'text-error'}" role="status">{pwResult.text}</p>
      {/if}
    </ConfigSection>

    <div class="mb-4">
      <Button label={$_('config.installer.lock')} variant="ghost" onclick={lock} />
    </div>
  {/if}
</ConfigPage>

<!-- Hardware maximum confirmation: repeats the one-time warning with the value. -->
<Modal visible={pendingSet} onclose={() => (pendingSet = false)}>
  <h2 class="mb-2 text-base font-semibold text-text">{$_('config.installer.confirm_title')}</h2>
  <p class="mb-3 text-sm text-text-dim">{$_('config.installer.confirm_body', { values: { amps } })}</p>
  <p class="mb-4 text-sm font-medium text-warning">{$_('config.installer.maxcurrent_note')}</p>
  <div class="flex gap-2">
    <Button label={$_('config.installer.confirm_yes')} onclick={setHardMax} />
    <Button label={$_('config.installer.confirm_no')} variant="ghost" onclick={() => (pendingSet = false)} />
  </div>
</Modal>
