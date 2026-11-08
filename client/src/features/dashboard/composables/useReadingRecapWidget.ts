import { fetchReadingRecap } from '../api/dashboard-widget.api'
import { useWidgetData, type WidgetData } from './useWidgetData'
import type { ReadingRecapWidget as ReadingRecapWidgetData } from '@bookorbit/types'

// Module-level singleton: DashboardWidgetRow needs this widget's data too, to decide whether to
// render the card shell at all (see useDashboardWidgets.spec / DashboardWidgetRow.spec "hides
// the card shell"), without triggering a second fetch of the same endpoint.
let shared: WidgetData<ReadingRecapWidgetData | null> | null = null

export function useReadingRecapWidget(): WidgetData<ReadingRecapWidgetData | null> {
  if (!shared) shared = useWidgetData(fetchReadingRecap)
  return shared
}

/** Test-only: lets specs reset the singleton between cases instead of leaking state across them. */
export function resetReadingRecapWidgetForTests(): void {
  shared = null
}
