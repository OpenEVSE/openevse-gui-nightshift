<script>
  import { onMount } from 'svelte'
  import { setupI18n } from './lib/i18n/index.js'
  import { theme } from './lib/stores/theme.js'
  import Loader from './lib/components/ui/Loader.svelte'
  import AppShell from './lib/components/shell/AppShell.svelte'
  import AlertBox from './lib/components/ui/AlertBox.svelte'
  import FetchData from './lib/data/FetchData.svelte'
  import WebSocket from './lib/data/WebSocket.svelte'
  import DataManager from './lib/data/DataManager.svelte'
  import { uistates_store } from './lib/stores/uistates.js'
  import { _, isLoading } from 'svelte-i18n'

  setupI18n()

  let loaded = $state(false)
  let progress = $state(0)
  let failed = $state(false)

  onMount(() => theme.init())
</script>

{#if $isLoading}
  <!-- Wait for the i18n catalog before rendering anything that uses $_ -->
  <Loader {progress} />
{:else if !loaded}
  <Loader {progress} />
  <FetchData
    onProgress={(p) => (progress = p)}
    onLoaded={() => (loaded = true)}
    onError={() => (failed = true)}
  />
  <AlertBox
    visible={failed}
    title={$_('connection.error')}
    body={$_('connection.lost_body')}
    button={true}
    label={$_('connection.reconnect')}
    closable={false}
    action={() => location.reload()}
  />
{:else}
  <AppShell />
  <WebSocket />
  <DataManager />
  <AlertBox
    visible={$uistates_store.alertbox.visible}
    title={$uistates_store.alertbox.title}
    body={$uistates_store.alertbox.body}
    button={$uistates_store.alertbox.button}
    closable={$uistates_store.alertbox.closable}
    action={$uistates_store.alertbox.action}
    onclose={() => ($uistates_store.alertbox.visible = false)}
  />
{/if}
