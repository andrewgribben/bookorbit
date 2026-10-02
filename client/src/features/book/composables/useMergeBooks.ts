import { ref } from 'vue'
import type { BookMergeResult } from '@bookorbit/types'
import { api } from '@/lib/api'

export function useMergeBooks() {
  const merging = ref(false)
  const error = ref<string | null>(null)

  async function mergeBooks(targetBookId: number, sourceBookIds: number[]): Promise<BookMergeResult | null> {
    if (merging.value) return null
    merging.value = true
    error.value = null
    try {
      const response = await api(`/api/v1/books/${targetBookId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceBookIds }),
      })
      if (!response.ok) {
        let message = `HTTP ${response.status}`
        try {
          const body = (await response.json()) as { message?: string | string[] }
          if (Array.isArray(body.message)) message = body.message.join(', ')
          else if (typeof body.message === 'string' && body.message.length > 0) message = body.message
        } catch {
          // Keep status fallback.
        }
        throw new Error(message)
      }
      return (await response.json()) as BookMergeResult
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Failed to merge books'
      return null
    } finally {
      merging.value = false
    }
  }

  return { merging, error, mergeBooks }
}
