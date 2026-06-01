<!-- src/routes/Settings.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import Card from '../lib/components/ui/Card.svelte'
  import Icon from '../lib/icons/Icon.svelte'
  import { pagesBySection } from '../lib/config/pages.js'
  import { config_store } from '../lib/stores/config.js'

  let groups = $derived(pagesBySection($config_store))
</script>

<section class="p-4">
  <h1 class="mb-4 text-lg font-semibold text-text">{$_('config.title')}</h1>

  {#each groups as group}
    <Card class="mb-4 p-4">
      <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
        {$_('config.sections.' + group.section)}
      </h2>
      <ul class="divide-y divide-border">
        {#each group.pages as page}
          <li>
            <a
              href="#{page.route}"
              class="flex items-center gap-3 py-3 text-text hover:text-accent"
            >
              <Icon icon={page.icon} size={20} class="text-text-dim" />
              <span class="flex-1 text-sm">{$_(page.labelKey)}</span>
              <Icon icon="mdi:chevron-right" size={18} class="text-text-dim" />
            </a>
          </li>
        {/each}
      </ul>
    </Card>
  {/each}
</section>
