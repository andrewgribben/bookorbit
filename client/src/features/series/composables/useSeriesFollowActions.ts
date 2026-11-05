import { getCurrentScope, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import type { SeriesFollowStatus } from '@bookorbit/types'
import { clearSeriesFollowStatus, markSeriesRead, markSeriesUnread, setSeriesFollowStatus } from '../api/series'

// Bulk status writes send no socket event, so views showing series state listen here instead.
const changedListeners = new Set<(seriesId: number) => void>()

export function onSeriesFollowChanged(listener: (seriesId: number) => void): () => void {
  changedListeners.add(listener)
  const cleanup = () => changedListeners.delete(listener)
  if (getCurrentScope()) onScopeDispose(cleanup)
  return cleanup
}

export function useSeriesFollowActions() {
  const { t } = useI18n()
  const pending = ref(false)

  async function run(seriesId: number, action: () => Promise<void>): Promise<boolean> {
    if (pending.value) return false
    pending.value = true
    try {
      await action()
      for (const listener of changedListeners) listener(seriesId)
      return true
    } catch {
      toast.error(t('series.follow.failed'))
      return false
    } finally {
      pending.value = false
    }
  }

  function setStatus(seriesId: number, status: SeriesFollowStatus | null): Promise<boolean> {
    return run(seriesId, async () => {
      if (status === null) await clearSeriesFollowStatus(seriesId)
      else await setSeriesFollowStatus(seriesId, status)
    })
  }

  function markRead(seriesId: number, upToBookId?: number): Promise<boolean> {
    return run(seriesId, async () => {
      const { updated } = await markSeriesRead(seriesId, upToBookId)
      toast.success(t('series.follow.markedRead', { count: updated }))
    })
  }

  function markUnreadFrom(seriesId: number, fromBookId: number): Promise<boolean> {
    return run(seriesId, async () => {
      const { updated } = await markSeriesUnread(seriesId, fromBookId)
      toast.success(t('series.follow.markedUnread', { count: updated }))
    })
  }

  return { pending, setStatus, markRead, markUnreadFrom }
}
