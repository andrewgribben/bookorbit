import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import type { SeriesFollowStatus } from '@bookorbit/types'
import { clearSeriesFollowStatus, markSeriesRead, setSeriesFollowStatus } from '../api/series'

export function useSeriesFollowActions() {
  const { t } = useI18n()
  const pending = ref(false)

  async function run(action: () => Promise<void>): Promise<boolean> {
    if (pending.value) return false
    pending.value = true
    try {
      await action()
      return true
    } catch {
      toast.error(t('series.follow.failed'))
      return false
    } finally {
      pending.value = false
    }
  }

  function setStatus(seriesId: number, status: SeriesFollowStatus | null): Promise<boolean> {
    return run(async () => {
      if (status === null) await clearSeriesFollowStatus(seriesId)
      else await setSeriesFollowStatus(seriesId, status)
    })
  }

  function markRead(seriesId: number, upToBookId?: number): Promise<boolean> {
    return run(async () => {
      const { updated } = await markSeriesRead(seriesId, upToBookId)
      toast.success(t('series.follow.markedRead', { count: updated }))
    })
  }

  return { pending, setStatus, markRead }
}
