import { computed, ref, type Ref } from 'vue'
import type { BookCard } from '@bookorbit/types'
import type { MergeBooksCandidate } from '@/features/book/components/MergeBooksSheet.vue'

export function useMergeBooksSelection(selectedIds: Ref<Set<number>>, books: Ref<BookCard[]>, onMergedBooks: (sourceIds: number[]) => void) {
  const mergeOpen = ref(false)

  const mergeCandidates = computed<MergeBooksCandidate[]>(() => {
    const ids = [...selectedIds.value]
    if (ids.length !== 2) return []
    return ids.map((id) => {
      const book = books.value.find((entry) => entry.id === id)
      if (book) {
        const formats = [...new Set(book.files.map((file) => file.format).filter((format): format is string => Boolean(format)))]
        return {
          id: book.id,
          title: book.title,
          authors: book.authors,
          formats,
          coverVersion: book.coverVersion,
          hasCover: book.hasCover,
        }
      }
      return {
        id,
        title: null,
        authors: [],
        formats: [],
        hasCover: false,
      }
    })
  })

  function openMergeForSelection(): void {
    if (selectedIds.value.size !== 2) return
    mergeOpen.value = true
  }

  function setMergeOpen(open: boolean): void {
    mergeOpen.value = open
  }

  function handleMerged(result: { targetBookId: number; mergedSourceBookIds: number[] }): void {
    mergeOpen.value = false
    onMergedBooks(result.mergedSourceBookIds)
  }

  return {
    mergeOpen,
    mergeCandidates,
    openMergeForSelection,
    setMergeOpen,
    handleMerged,
  }
}
