<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Check, GitMerge, Loader2, Search, X } from '@lucide/vue'
import type { BookCard, BookDetail, BooksPage } from '@bookorbit/types'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useCoverVersions } from '@/features/book/composables/useCoverVersions'
import { useMergeBooks } from '@/features/book/composables/useMergeBooks'
import { formatKeyName } from '@/features/book/lib/book-formats'

export type MergeBooksCandidate = {
  id: number
  title: string | null
  authors: string[]
  formats: string[]
  coverVersion?: string
  hasCover?: boolean
}

const props = defineProps<{
  open: boolean
  /** Files-tab flow: this book stays; pick sources to fold in. */
  targetBook?: Pick<BookDetail, 'id' | 'libraryId' | 'title'> | null
  /** Multi-select flow: choose which of these two to keep. */
  candidates?: MergeBooksCandidate[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  merged: [result: { targetBookId: number; mergedSourceBookIds: number[] }]
}>()

const { t } = useI18n()
const { coverUrl } = useCoverVersions()
const merge = useMergeBooks()

const mode = computed(() => (props.targetBook ? 'sources' : 'target'))
const search = ref('')
const searchResults = ref<MergeBooksCandidate[]>([])
const searchLoading = ref(false)
const selectedSourceIds = ref<Set<number>>(new Set())
const selectedTargetId = ref<number | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null
let searchGeneration = 0

const candidateList = computed(() => props.candidates ?? [])

const canConfirm = computed(() => {
  if (merge.merging.value) return false
  if (mode.value === 'target') {
    return selectedTargetId.value != null && candidateList.value.length === 2
  }
  return selectedSourceIds.value.size > 0
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    search.value = ''
    searchResults.value = []
    selectedSourceIds.value = new Set()
    selectedTargetId.value = candidateList.value[0]?.id ?? null
    merge.error.value = null
  },
)

watch(search, (value) => {
  if (mode.value !== 'sources' || !props.targetBook) return
  if (searchTimer) clearTimeout(searchTimer)
  const term = value.trim()
  if (term.length < 2) {
    searchResults.value = []
    searchLoading.value = false
    return
  }
  searchLoading.value = true
  const generation = ++searchGeneration
  searchTimer = setTimeout(() => {
    void runSearch(term, generation)
  }, 250)
})

function toCandidate(book: BookCard): MergeBooksCandidate {
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

async function runSearch(term: string, generation: number): Promise<void> {
  const target = props.targetBook
  if (!target) return
  try {
    const response = await api(`/api/v1/libraries/${target.libraryId}/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: term,
        sort: [{ field: 'title', dir: 'asc' }],
        pagination: { page: 0, size: 20 },
      }),
    })
    if (generation !== searchGeneration) return
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const page = (await response.json()) as BooksPage
    if (generation !== searchGeneration) return
    searchResults.value = page.items.filter((book) => book.id !== target.id).map(toCandidate)
  } catch {
    if (generation !== searchGeneration) return
    searchResults.value = []
  } finally {
    if (generation === searchGeneration) searchLoading.value = false
  }
}

function toggleSource(id: number): void {
  const next = new Set(selectedSourceIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedSourceIds.value = next
}

function selectTarget(id: number): void {
  selectedTargetId.value = id
}

function authorLabel(authors: string[]): string {
  if (authors.length === 0) return t('book.merge.unknownAuthor')
  return authors.join(', ')
}

function formatLabel(formats: string[]): string {
  if (formats.length === 0) return t('book.merge.noFormats')
  return formats.map((format) => formatKeyName(format)).join(', ')
}

function close(): void {
  if (merge.merging.value) return
  emit('update:open', false)
}

async function confirm(): Promise<void> {
  if (!canConfirm.value) return

  let targetBookId: number
  let sourceBookIds: number[]

  if (mode.value === 'target') {
    if (selectedTargetId.value == null) return
    targetBookId = selectedTargetId.value
    sourceBookIds = candidateList.value.filter((book) => book.id !== targetBookId).map((book) => book.id)
  } else {
    if (!props.targetBook) return
    targetBookId = props.targetBook.id
    sourceBookIds = [...selectedSourceIds.value]
  }

  const result = await merge.mergeBooks(targetBookId, sourceBookIds)
  if (!result) {
    toast.error(merge.error.value ?? t('book.merge.failed'))
    return
  }

  toast.success(
    t('book.merge.success', {
      count: result.movedFileCount,
      books: result.mergedSourceBookIds.length,
    }),
  )
  emit('merged', { targetBookId: result.targetBookId, mergedSourceBookIds: result.mergedSourceBookIds })
  emit('update:open', false)
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent side="right" class="flex w-full flex-col gap-0 p-0 sm:max-w-md">
      <SheetHeader class="border-b border-border px-5 py-4">
        <SheetTitle class="flex items-center gap-2 text-base">
          <GitMerge class="size-5 text-primary" aria-hidden="true" />
          {{ mode === 'sources' ? t('book.merge.titleInto') : t('book.merge.titleChoose') }}
        </SheetTitle>
        <p class="text-sm text-muted-foreground">
          {{
            mode === 'sources'
              ? t('book.merge.descriptionInto', { title: targetBook?.title ?? t('book.merge.thisBook') })
              : t('book.merge.descriptionChoose')
          }}
        </p>
      </SheetHeader>

      <div class="flex min-h-0 flex-1 flex-col px-5 py-4">
        <template v-if="mode === 'sources'">
          <label class="relative block shrink-0">
            <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              v-model="search"
              class="pl-9"
              :placeholder="t('book.merge.searchPlaceholder')"
              data-testid="merge-book-search"
              autocomplete="off"
            />
          </label>

          <div class="mt-3 min-h-0 flex-1 overflow-y-auto">
            <p v-if="search.trim().length < 2" class="py-8 text-center text-sm text-muted-foreground">
              {{ t('book.merge.searchHint') }}
            </p>
            <div v-else-if="searchLoading" class="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 class="size-4 animate-spin" aria-hidden="true" />
              {{ t('common.loading') }}
            </div>
            <p v-else-if="searchResults.length === 0" class="py-8 text-center text-sm text-muted-foreground">
              {{ t('book.merge.noResults') }}
            </p>
            <ul v-else class="space-y-1.5" role="listbox" :aria-label="t('book.merge.searchPlaceholder')">
              <li v-for="book in searchResults" :key="book.id">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors"
                  :class="selectedSourceIds.has(book.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'"
                  :aria-selected="selectedSourceIds.has(book.id)"
                  data-testid="merge-source-option"
                  @click="toggleSource(book.id)"
                >
                  <img
                    v-if="book.hasCover"
                    :src="coverUrl(book.id, 'thumbnail', book.coverVersion)"
                    alt=""
                    class="h-12 w-8 shrink-0 rounded border border-border object-cover"
                  />
                  <span v-else class="flex h-12 w-8 shrink-0 items-center justify-center rounded border border-border bg-muted" aria-hidden="true" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">{{ book.title ?? t('book.merge.untitled') }}</span>
                    <span class="block truncate text-xs text-muted-foreground">{{ authorLabel(book.authors) }}</span>
                    <span class="block truncate text-xs text-muted-foreground">{{ formatLabel(book.formats) }}</span>
                  </span>
                  <Check v-if="selectedSourceIds.has(book.id)" class="size-4 shrink-0 text-primary" aria-hidden="true" />
                </button>
              </li>
            </ul>
          </div>
        </template>

        <template v-else>
          <p class="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {{ t('book.merge.selectTarget') }}
          </p>
          <ul class="space-y-1.5 overflow-y-auto" role="listbox" :aria-label="t('book.merge.selectTarget')">
            <li v-for="book in candidateList" :key="book.id">
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors"
                :class="selectedTargetId === book.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'"
                :aria-selected="selectedTargetId === book.id"
                data-testid="merge-target-option"
                @click="selectTarget(book.id)"
              >
                <img
                  v-if="book.hasCover"
                  :src="coverUrl(book.id, 'thumbnail', book.coverVersion)"
                  alt=""
                  class="h-12 w-8 shrink-0 rounded border border-border object-cover"
                />
                <span v-else class="flex h-12 w-8 shrink-0 items-center justify-center rounded border border-border bg-muted" aria-hidden="true" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{{ book.title ?? t('book.merge.untitled') }}</span>
                  <span class="block truncate text-xs text-muted-foreground">{{ authorLabel(book.authors) }}</span>
                  <span class="block truncate text-xs text-muted-foreground">{{ formatLabel(book.formats) }}</span>
                </span>
                <Check v-if="selectedTargetId === book.id" class="size-4 shrink-0 text-primary" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </template>

        <p v-if="merge.error.value" role="alert" class="mt-3 text-xs text-destructive">{{ merge.error.value }}</p>
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-border bg-muted/20 px-5 py-3">
        <Button variant="ghost" :disabled="merge.merging.value" @click="close">
          <X class="size-4" aria-hidden="true" />
          {{ t('common.cancel') }}
        </Button>
        <Button data-testid="merge-confirm" :disabled="!canConfirm" @click="confirm">
          <Loader2 v-if="merge.merging.value" class="size-4 animate-spin" aria-hidden="true" />
          <GitMerge v-else class="size-4" aria-hidden="true" />
          {{ mode === 'sources' ? t('book.merge.confirmInto', { count: selectedSourceIds.size }) : t('book.merge.confirmChoose') }}
        </Button>
      </div>
    </SheetContent>
  </Sheet>
</template>
