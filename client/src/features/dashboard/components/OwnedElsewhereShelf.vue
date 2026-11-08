<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, Library, RefreshCw } from '@lucide/vue'
import { useRouter } from 'vue-router'

import type { ExternalBookCard } from '@bookorbit/types'
import { useOwnedElsewhereShelf } from '../composables/useOwnedElsewhereShelf'

const { books, total, loading, error, refresh } = useOwnedElsewhereShelf()
const { t } = useI18n()
const router = useRouter()

const scrollEl = ref<HTMLElement | null>(null)

function scrollBy(delta: number) {
  scrollEl.value?.scrollBy({ left: delta, behavior: 'smooth' })
}

// Open the matching BookOrbit book when the pure matcher found one; otherwise the book's
// Readwise page in a new tab, per the mockup's tap behaviour.
function openCard(book: ExternalBookCard) {
  if (book.libraryBookId) {
    void router.push({ name: 'book-detail', params: { bookId: book.libraryBookId } })
  } else if (book.providerUrl) {
    window.open(book.providerUrl, '_blank', 'noopener')
  }
}
</script>

<template>
  <section
    v-if="loading || error || books.length > 0"
    class="group/scroller overflow-hidden rounded-2xl border border-primary/40 bg-card/30 shadow-sm backdrop-blur-[1px]"
  >
    <div class="mb-2 flex items-center justify-between px-5 pt-4">
      <div class="flex items-center gap-2.5">
        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50">
          <Library :size="14" class="text-foreground" />
        </div>
        <h2 class="text-[15px] font-bold tracking-tight">{{ t('dashboard.ownedElsewhere.title') }}</h2>
        <span
          v-if="!loading && !error && total"
          class="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-bold tabular-nums text-foreground"
        >
          {{ total }}
        </span>
      </div>
      <div class="flex items-center gap-0.5 opacity-0 transition-opacity duration-200 group-hover/scroller:opacity-100">
        <button
          class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          @click="scrollBy(-560)"
        >
          <ChevronLeft :size="16" />
        </button>
        <button
          class="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          @click="scrollBy(560)"
        >
          <ChevronRight :size="16" />
        </button>
      </div>
    </div>
    <p class="px-5 pb-2 text-xs text-muted-foreground">{{ t('dashboard.ownedElsewhere.description') }}</p>

    <div v-if="loading" class="flex gap-3 overflow-hidden px-5 pb-5">
      <div v-for="n in 6" :key="n" class="w-[120px] shrink-0">
        <div class="w-full animate-pulse rounded-lg bg-muted" style="aspect-ratio: 2/3" />
      </div>
    </div>

    <div v-else-if="error" class="flex items-center gap-2.5 px-5 pb-4 pt-1 text-sm text-muted-foreground">
      <span>{{ t('dashboard.ownedElsewhere.failedToLoad') }}</span>
      <button class="flex items-center gap-1.5 text-xs text-primary hover:underline" @click="refresh">
        <RefreshCw :size="12" />
        {{ t('dashboard.common.retry') }}
      </button>
    </div>

    <div v-else ref="scrollEl" class="overflow-x-auto px-5 pb-5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div class="flex w-max gap-3">
        <button
          v-for="book in books"
          :key="`${book.provider}:${book.isbn13 ?? book.title}`"
          type="button"
          class="w-[120px] shrink-0 text-left"
          @click="openCard(book)"
        >
          <!-- Cover-missing cards share the exact aspect ratio of real covers: no taller fallback tile. -->
          <div class="relative overflow-hidden rounded-lg bg-muted" style="aspect-ratio: 2/3">
            <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title" class="h-full w-full object-cover" />
            <div v-else class="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
              <span class="line-clamp-3 text-[11px] font-medium text-foreground">{{ book.title }}</span>
              <span v-if="book.author" class="line-clamp-2 text-[10px] text-muted-foreground">{{ book.author }}</span>
            </div>
            <span
              class="absolute left-1.5 top-1.5 rounded-full border border-border bg-background/80 px-1.5 py-0.5 text-[9px] font-medium capitalize text-foreground backdrop-blur-sm"
            >
              {{ book.provider }}
            </span>
          </div>
          <p class="mt-1.5 truncate text-xs font-semibold leading-tight text-foreground">{{ book.title }}</p>
          <p v-if="book.author" class="truncate text-[11px] text-muted-foreground">{{ book.author }}</p>
        </button>
      </div>
    </div>
  </section>
</template>
