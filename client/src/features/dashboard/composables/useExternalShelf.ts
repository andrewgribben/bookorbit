import { onMounted, ref } from 'vue'

import type { ReadingServiceProvider, ReadingServiceShelf, ReadingServiceShelfItem } from '@bookorbit/types'
import { api } from '@/lib/api'

/**
 * Fetches one generic reading-service shelf (friends' current/recent reads, trending,
 * recommendations, or a provider's "owned elsewhere" shelf) from
 * `GET /api/v1/reading-services/:provider/shelves/:shelf`. One composable for every
 * provider/shelf pair, replacing the old Readwise-only `useOwnedElsewhereShelf`.
 */
export function useExternalShelf(provider: ReadingServiceProvider, shelf: ReadingServiceShelf) {
  const items = ref<ReadingServiceShelfItem[]>([])
  const loading = ref(true)
  const error = ref(false)

  async function load(): Promise<void> {
    loading.value = true
    error.value = false
    try {
      const response = await api(`/api/v1/reading-services/${provider}/shelves/${shelf}`)
      if (!response.ok) throw new Error(`${provider} ${shelf} shelf failed: ${response.status}`)
      items.value = await response.json()
    } catch {
      items.value = []
      error.value = true
    } finally {
      loading.value = false
    }
  }

  onMounted(load)
  return { items, loading, error, refresh: load }
}
