<script>
  import { _ } from 'svelte-i18n'
  import { schedule_store } from '../lib/stores/schedule.js'
  import { serialQueue } from '../lib/queue.js'
  import { showWriteError } from '../lib/alerts.js'
  import { nextTimerId } from '../lib/schedule/timers.js'
  import Button from '../lib/components/ui/Button.svelte'
  import TimerList from '../lib/components/schedule/TimerList.svelte'
  import TimerModal from '../lib/components/schedule/TimerModal.svelte'

  const MAX_TIMERS = 50

  let editorOpen = $state(false)
  let editingTimer = $state(null)
  let busy = $state(false)
  let removingId = $state(null)

  let timers = $derived(Array.isArray($schedule_store) ? $schedule_store : [])

  function openAdd() {
    editingTimer = null
    editorOpen = true
  }
  function openEdit(timer) {
    editingTimer = timer
    editorOpen = true
  }

  async function save(data) {
    if (busy) return
    busy = true
    try {
      const timer = editingTimer
        ? { ...editingTimer, ...data }
        : { id: nextTimerId(timers), ...data }
      const ok = await serialQueue.add(() => schedule_store.upload(timer))
      if (ok) {
        editorOpen = false
        await serialQueue.add(() => schedule_store.download())
      } else {
        showWriteError()
      }
    } finally {
      busy = false
    }
  }

  async function remove(id) {
    if (busy) return
    busy = true
    removingId = id
    try {
      const ok = await serialQueue.add(() => schedule_store.remove(id))
      if (ok) {
        await serialQueue.add(() => schedule_store.download())
      } else {
        showWriteError()
      }
    } finally {
      busy = false
      removingId = null
    }
  }
</script>

<section class="p-4 lg:mx-auto lg:max-w-3xl">
  <div class="mb-3 flex items-baseline justify-between">
    <h1 class="text-lg font-semibold text-text">{$_('screen.schedule')}</h1>
    <span class="text-xs text-text-dim">
      {$_('schedule.count', { values: { n: timers.length, max: MAX_TIMERS } })}
    </span>
  </div>

  <TimerList
    {timers}
    {removingId}
    disabled={busy}
    onedit={openEdit}
    ondelete={remove}
  />

  <div class="mt-4">
    <Button
      label={'+ ' + $_('schedule.new')}
      disabled={busy || timers.length >= MAX_TIMERS}
      onclick={openAdd}
    />
  </div>
</section>

<TimerModal
  open={editorOpen}
  timer={editingTimer}
  {busy}
  onclose={() => (editorOpen = false)}
  onsave={save}
/>
