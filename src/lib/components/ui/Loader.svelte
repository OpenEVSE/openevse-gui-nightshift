<script>
  import GearMark from '../../assets/GearMark.svelte'
  import ProgressBar from './ProgressBar.svelte'
  let { progress = 0 } = $props()
</script>

<div class="fixed inset-0 z-50 grid place-items-center bg-surface">
  <div class="flex w-56 flex-col items-center gap-6">
    <GearMark size={84} class="text-accent" />
    <ProgressBar value={progress} />
  </div>
</div>
