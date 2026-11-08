import { onMounted, ref } from 'vue'

import type { ExternalBookCard, ExternalBookShelfResponse } from '@bookorbit/types'
import { api } from '@/lib/api'

/**
 * Fetches the "Owned elsewhere" dashboard shelf (S7, D1): Readwise-owned books not yet in the
 * BookOrbit library. Not batched with the scroller/widget systems — `ExternalBookCard` isn't a
 * `BookCard`, so this has its own small endpoint and its own composable, matching the mockup's
 * decision to give it its own component rather than force it through `DashboardScroller.vue`.
 */
export function useOwnedElsewhereShelf() {
  const books = ref<ExternalBookCard[]>([])
  const total = ref<number | null>(null)
  const loading = ref(true)
  const error = ref(false)

  async function load(): Promise<void> {
    loading.value = true
    error.value = false
    try {
      const response = await api('/api/v1/dashboard/shelves/owned-elsewhere')
      if (!response.ok) throw new Error(`Owned-elsewhere shelf failed: ${response.status}`)
      const payload: ExternalBookShelfResponse = await response.json()
      books.value = payload.books
      total.value = payload.total
    } catch {
      books.value = []
      total.value = null
      error.value = true
    } finally {
      loading.value = false
    }
  }

  onMounted(load)
  return { books, total, loading, error, refresh: load }
}
