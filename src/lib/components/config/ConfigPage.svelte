<!-- src/lib/components/config/ConfigPage.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import Icon from '../../icons/Icon.svelte'

  let { title = '', loading = false, children } = $props()
</script>

<section class="p-4 lg:mx-auto lg:max-w-2xl">
  <a
    href="#/settings"
    class="mb-3 inline-flex items-center gap-1 text-sm text-text-dim hover:text-text"
  >
    <Icon icon="mdi:chevron-left" size={18} />
    <span>{$_('config.back')}</span>
  </a>
  <h1 class="mb-4 text-lg font-semibold text-text">{title}</h1>

  {#if loading}
    <div class="flex justify-center py-10">
      <Icon icon="mdi:loading" size={28} class="animate-spin text-text-dim" />
    </div>
  {:else}
    {@render children?.()}
  {/if}
</section>
