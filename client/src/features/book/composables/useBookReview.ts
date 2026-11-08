import { computed, ref, watch, type Ref } from 'vue'
import type { BookDetail } from '@bookorbit/types'
import { api } from '@/lib/api'

export const BOOK_REVIEW_MAX_LENGTH = 10000

function normalizeReviewValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

export function useBookReview(book: Ref<BookDetail>) {
  const draft = ref('')
  const editing = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const preview = computed(() => normalizeReviewValue(book.value.review) ?? '')
  const hasReview = computed(() => preview.value.length > 0)
  const normalizedDraft = computed(() => normalizeReviewValue(draft.value))
  const normalizedSaved = computed(() => normalizeReviewValue(book.value.review))
  const hasChanges = computed(() => normalizedDraft.value !== normalizedSaved.value)
  const canSave = computed(() => hasChanges.value && !saving.value)
  const canClearDraft = computed(() => normalizedDraft.value !== null)
  const charCount = computed(() => draft.value.length)

  function resetDraft() {
    draft.value = book.value.review ?? ''
    error.value = null
    editing.value = false
  }

  watch(() => [book.value.id, book.value.review] as const, resetDraft, { immediate: true })

  function startEdit() {
    if (saving.value) return
    draft.value = book.value.review ?? ''
    error.value = null
    editing.value = true
  }

  function cancelEdit() {
    if (saving.value) return
    draft.value = book.value.review ?? ''
    error.value = null
    editing.value = false
  }

  function clearDraft() {
    if (saving.value) return
    draft.value = ''
  }

  async function save(): Promise<BookDetail | null> {
    if (!canSave.value) return null
    saving.value = true
    error.value = null

    try {
      const res = await api(`/api/v1/books/${book.value.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review: normalizedDraft.value }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const updated = (await res.json()) as BookDetail
      draft.value = updated.review ?? ''
      editing.value = false
      return updated
    } catch {
      error.value = 'Failed to save review.'
      return null
    } finally {
      saving.value = false
    }
  }

  return {
    draft,
    editing,
    saving,
    error,
    preview,
    hasReview,
    canSave,
    canClearDraft,
    charCount,
    startEdit,
    cancelEdit,
    clearDraft,
    save,
  }
}
