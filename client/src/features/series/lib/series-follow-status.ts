import type { SeriesFollowStatus } from '@bookorbit/types'

const LABEL_KEYS: Record<SeriesFollowStatus, string> = {
  reading: 'series.follow.status.reading',
  caught_up: 'series.follow.status.caughtUp',
  completed: 'series.follow.status.completed',
  on_hold: 'series.follow.status.onHold',
  dropped: 'series.follow.status.dropped',
}

export function seriesFollowStatusLabelKey(status: SeriesFollowStatus): string {
  return LABEL_KEYS[status]
}
