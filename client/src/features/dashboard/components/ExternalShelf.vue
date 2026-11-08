<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, Library, RefreshCw } from '@lucide/vue'
import { useRouter } from 'vue-router'

import type { ReadingServiceProvider, ReadingServiceShelf, ReadingServiceShelfItem } from '@bookorbit/types'
import { useExternalShelf } from '../composables/useExternalShelf'

/**
 * One dashboard shelf for any (provider, shelf) pair served by
 * `GET /api/v1/reading-services/:provider/shelves/:shelf` - the generic replacement for the
 * Readwise-only `OwnedElsewhereShelf.vue`. `titleKey`/`descriptionKey` let each call site reuse
 * its own locale strings rather than this component owning copy for every possible shelf.
 */
const props = defineProps<{
  provider: ReadingServiceProvider
  shelf: ReadingServiceShelf
  titleKey?: string
  descriptionKey?: string
  title?: string
  description?: string
}>()

const { items, loading, error, refresh } = useExternalShelf(props.provider, props.shelf)
const { t } = useI18n()
const router = useRouter()

const scrollEl = ref<HTMLElement | null>(null)

// A caller passes either a locale key (resolved here) or an already-resolved string (e.g. a
// generic picker shelf whose title/description is composed per provider+shelf at the call
// site, see useDashboardLabels). Exactly one of each pair is expected; a caller supplying
// neither gets an empty heading rather than a crash.
const titleText = computed(() => props.title ?? (props.titleKey ? t(props.titleKey) : ''))
const descriptionText = computed(() => props.description ?? (props.descriptionKey ? t(props.descriptionKey) : ''))

function scrollBy(delta: number) {
  scrollEl.value?.scrollBy({ left: delta, behavior: 'smooth' })
}

// Open the matched BookOrbit book when one was found; otherwise the item's page on the
// provider's own site, in a new tab.
function openCard(item: ReadingServiceShelfItem) {
  if (item.bookId) {
    void router.push({ name: 'book-detail', params: { bookId: item.bookId } })
  } else if (item.externalUrl) {
    window.open(item.externalUrl, '_blank', 'noopener')
  }
}
</script>

<template>
  <section
    v-if="loading || error || items.length > 0"
    class="group/scroller overflow-hidden rounded-2xl border border-primary/40 bg-card/30 shadow-sm backdrop-blur-[1px]"
  >
    <div class="mb-2 flex items-center justify-between px-5 pt-4">
      <div class="flex items-center gap-2.5">
        <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50">
          <Library :size="14" class="text-foreground" />
        </div>
        <h2 class="text-[15px] font-bold tracking-tight">{{ titleText }}</h2>
        <span
          v-if="!loading && !error && items.length > 0"
          class="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-bold tabular-nums text-foreground"
        >
          {{ items.length }}
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
    <p class="px-5 pb-2 text-xs text-muted-foreground">{{ descriptionText }}</p>

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
          v-for="item in items"
          :key="`${item.provider}:${item.externalId}`"
          type="button"
          class="w-[120px] shrink-0 text-left"
          @click="openCard(item)"
        >
          <!-- Cover-missing cards share the exact aspect ratio of real covers: no taller fallback tile. -->
          <div class="relative overflow-hidden rounded-lg bg-muted" style="aspect-ratio: 2/3">
            <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" class="h-full w-full object-cover" />
            <div v-else class="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center">
              <span class="line-clamp-3 text-[11px] font-medium text-foreground">{{ item.title }}</span>
              <span v-if="item.authors.length > 0" class="line-clamp-2 text-[10px] text-muted-foreground">{{ item.authors.join(', ') }}</span>
            </div>
            <span
              class="absolute left-1.5 top-1.5 rounded-full border border-border bg-background/80 px-1.5 py-0.5 text-[9px] font-medium capitalize text-foreground backdrop-blur-sm"
            >
              {{ item.provider }}
            </span>
          </div>
          <p class="mt-1.5 truncate text-xs font-semibold leading-tight text-foreground">{{ item.title }}</p>
          <p v-if="item.authors.length > 0" class="truncate text-[11px] text-muted-foreground">{{ item.authors.join(', ') }}</p>
          <!-- Friends shelves (friends-reading/friends-finished): who is reading it and their status. -->
          <div v-if="item.friend" class="mt-1 flex items-center gap-1">
            <img v-if="item.friend.avatarUrl" :src="item.friend.avatarUrl" :alt="item.friend.displayName" class="h-4 w-4 rounded-full object-cover" />
            <span class="truncate text-[10px] text-muted-foreground">{{ item.friend.displayName }} &middot; {{ item.friend.status }}</span>
          </div>
        </button>
      </div>
    </div>
  </section>
</template>
