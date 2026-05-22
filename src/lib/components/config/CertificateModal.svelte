<!-- src/lib/components/config/CertificateModal.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import Modal from '../ui/Modal.svelte'
  import Select from '../ui/Select.svelte'
  import Button from '../ui/Button.svelte'

  let { open = false, busy = false, onclose = () => {}, onsubmit = () => {} } = $props()

  let type = $state('root')
  let name = $state('')
  let certificate = $state('')
  let privateKey = $state('')

  let typeOptions = $derived([
    { value: 'root', label: $_('config.certificates.root') },
    { value: 'client', label: $_('config.certificates.client') },
  ])
  let canSave = $derived(
    name.trim() !== '' &&
    certificate.trim() !== '' &&
    (type !== 'client' || privateKey.trim() !== ''),
  )

  function submit() {
    const cert = { type, name, certificate }
    if (type === 'client') cert.key = privateKey
    onsubmit(cert)
  }
</script>

<Modal visible={open} {onclose}>
  <div class="p-4">
    <h2 class="mb-3 text-base font-semibold text-text">{$_('config.certificates.add')}</h2>

    <label class="mb-1 block text-sm text-text">{$_('config.certificates.type')}</label>
    <Select options={typeOptions} value={type} onchange={(v) => (type = v)} />

    <label class="mb-1 mt-3 block text-sm text-text" for="cert-name">
      {$_('config.certificates.name')}
    </label>
    <input
      id="cert-name"
      aria-label={$_('config.certificates.name')}
      value={name}
      oninput={(e) => (name = e.currentTarget.value)}
      class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text
             focus:border-accent focus:outline-none"
    />

    <label class="mb-1 mt-3 block text-sm text-text" for="cert-body">
      {$_('config.certificates.certificate')}
    </label>
    <textarea
      id="cert-body"
      aria-label={$_('config.certificates.certificate')}
      rows="4"
      value={certificate}
      oninput={(e) => (certificate = e.currentTarget.value)}
      placeholder="-----BEGIN CERTIFICATE-----"
      class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono text-xs
             text-text focus:border-accent focus:outline-none"
    ></textarea>

    {#if type === 'client'}
      <label class="mb-1 mt-3 block text-sm text-text" for="cert-key">
        {$_('config.certificates.private_key')}
      </label>
      <textarea
        id="cert-key"
        aria-label={$_('config.certificates.private_key')}
        rows="4"
        value={privateKey}
        oninput={(e) => (privateKey = e.currentTarget.value)}
        placeholder="-----BEGIN RSA PRIVATE KEY-----"
        class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono text-xs
               text-text focus:border-accent focus:outline-none"
      ></textarea>
    {/if}

    <div class="mt-4 flex gap-2">
      <Button label={$_('config.certificates.save')} disabled={!canSave || busy} onclick={submit} />
      <Button label={$_('config.certificates.cancel')} variant="ghost" onclick={onclose} />
    </div>
  </div>
</Modal>
