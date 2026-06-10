<script>
  import { _ } from 'svelte-i18n'
  import { navigate } from '../lib/router.js'
  import Button from '../lib/components/ui/Button.svelte'
</script>

<section class="flex flex-col items-center gap-3 px-4 py-16 text-center">
  <h1 class="text-lg font-semibold text-text">{$_('screen.notfound')}</h1>
  <p class="text-sm text-text-dim">{$_('screen.notfound_body')}</p>
  <Button label={$_('screen.notfound_home')} onclick={() => navigate('/')} />
</section>
