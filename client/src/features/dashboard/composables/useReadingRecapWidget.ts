import { fetchReadingRecap } from '../api/dashboard-widget.api'
import { useWidgetData } from './useWidgetData'

export function useReadingRecapWidget() {
  return useWidgetData(fetchReadingRecap)
}
