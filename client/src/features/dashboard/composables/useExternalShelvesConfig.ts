import { computed, onMounted, ref } from 'vue'

import type { ExternalShelfConfig, ReadingServiceAvailableShelf, ReadingServiceSummary } from '@bookorbit/types'
import { api } from '@/lib/api'
import { useDashboardConfig } from './useDashboardConfig'

/** One row of `useExternalShelvesConfig().pickerShelves`: an available shelf plus its persisted toggle. */
export interface ExternalShelfPickerRow extends ReadingServiceAvailableShelf {
  enabled: boolean
  order: number
}

/**
 * Drives the "Customize Dashboard" external-shelves picker (owner decision 1): fetches every
 * shelf a connected provider currently exposes from `GET /reading-services/shelves/available`,
 * merges it with the persisted `externalShelves` list (`useDashboardConfig`), and seeds a
 * sensible default the first time a shelf is seen - `owned-elsewhere` starts enabled only when
 * its provider is connected and the `owned` feature is on (from `GET /reading-services`);
 * every other shelf starts off until the user turns it on.
 */
export function useExternalShelvesConfig() {
  const { externalShelves, ensureExternalShelf } = useDashboardConfig()
  const availableShelves = ref<ReadingServiceAvailableShelf[]>([])
  const loading = ref(true)
  const loaded = ref(false)

  async function fetchAvailableShelves(): Promise<void> {
    loading.value = true
    try {
      const [shelvesResponse, summariesResponse] = await Promise.all([
        api('/api/v1/reading-services/shelves/available'),
        api('/api/v1/reading-services'),
      ])
      const shelves: ReadingServiceAvailableShelf[] = shelvesResponse.ok ? await shelvesResponse.json() : []
      const summaries: ReadingServiceSummary[] = summariesResponse.ok ? await summariesResponse.json() : []
      const ownedFeatureOn = new Map(summaries.map((summary) => [summary.provider, summary.features.owned !== false]))

      availableShelves.value = shelves
      shelves.forEach((shelf) => {
        const defaultEnabled = shelf.shelf === 'owned-elsewhere' && shelf.connected && (ownedFeatureOn.get(shelf.provider) ?? false)
        ensureExternalShelf(shelf.provider, shelf.shelf, defaultEnabled)
      })
    } catch {
      availableShelves.value = []
    } finally {
      loading.value = false
      loaded.value = true
    }
  }

  /** Available shelves the user has turned on, in their configured order - what the dashboard itself renders. */
  const enabledExternalShelves = computed<ExternalShelfConfig[]>(() => {
    const connectedKeys = new Set(availableShelves.value.filter((shelf) => shelf.connected).map((shelf) => `${shelf.provider}:${shelf.shelf}`))
    return externalShelves.value
      .filter((entry) => entry.enabled && connectedKeys.has(`${entry.provider}:${entry.shelf}`))
      .slice()
      .sort((a, b) => a.order - b.order)
  })

  /** Every currently available shelf with its persisted toggle, for the Customize Dashboard sheet. */
  const pickerShelves = computed<ExternalShelfPickerRow[]>(() =>
    availableShelves.value
      .map((available, index) => {
        const persisted = externalShelves.value.find((entry) => entry.provider === available.provider && entry.shelf === available.shelf)
        return { ...available, enabled: persisted?.enabled ?? false, order: persisted?.order ?? index + 1 }
      })
      .sort((a, b) => a.order - b.order),
  )

  onMounted(fetchAvailableShelves)

  return { availableShelves, enabledExternalShelves, pickerShelves, loading, loaded, fetchAvailableShelves }
}
