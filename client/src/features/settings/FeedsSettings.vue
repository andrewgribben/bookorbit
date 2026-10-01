<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Copy, Podcast, Search } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import { api } from '@/lib/api'
import { copyToClipboard } from '@/lib/clipboard'

const { t } = useI18n()

type CatalogItem = {
  bookId: number
  libraryId: number
  title: string
  authors: string[]
  feedEnabled: boolean
  publicId: string | null
  feedUrl: string | null
}

const items = ref<CatalogItem[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)
const query = ref('')
const offset = ref(0)
const limit = 50
const togglingIds = ref<Set<number>>(new Set())

async function loadCatalog() {
  loading.value = true
  error.value = null
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset.value),
    })
    if (query.value.trim()) params.set('q', query.value.trim())
    const res = await api(`/api/v1/audiobook-feeds/catalog?${params}`)
    if (!res.ok) throw new Error(t('settings.reader.feeds.loadFailed'))
    const body = await res.json()
    items.value = body.items ?? []
    total.value = body.total ?? 0
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('settings.reader.feeds.loadFailed')
  } finally {
    loading.value = false
  }
}

onMounted(loadCatalog)

async function search() {
  offset.value = 0
  await loadCatalog()
}

async function toggleFeed(item: CatalogItem) {
  const enabled = !item.feedEnabled
  togglingIds.value = new Set(togglingIds.value).add(item.bookId)
  try {
    const res = await api(`/api/v1/audiobook-feeds/books/${item.bookId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(((body as Record<string, unknown>).message as string) ?? t('settings.reader.feeds.updateFailed'))
    }
    const updated = await res.json()
    items.value = items.value.map((row) =>
      row.bookId === item.bookId
        ? {
            ...row,
            feedEnabled: updated.feedEnabled,
            publicId: updated.publicId,
            feedUrl: updated.feedUrl,
          }
        : row,
    )
    toast.success(enabled ? t('settings.reader.feeds.enabled') : t('settings.reader.feeds.disabled'))
  } catch (err) {
    toast.error(err instanceof Error ? err.message : t('settings.reader.feeds.updateFailed'))
  } finally {
    const next = new Set(togglingIds.value)
    next.delete(item.bookId)
    togglingIds.value = next
  }
}

async function copyFeedUrl(item: CatalogItem) {
  const url = item.feedUrl ?? (item.publicId ? `${window.location.origin}/api/v1/feeds/${item.publicId}` : null)
  if (!url) return
  const copied = await copyToClipboard(url)
  if (copied) toast.success(t('settings.reader.feeds.urlCopied'))
  else toast.error(t('settings.reader.feeds.urlCopyFailed'))
}

function displayUrl(item: CatalogItem): string {
  return item.feedUrl ?? (item.publicId ? `${window.location.origin}/api/v1/feeds/${item.publicId}` : '')
}

async function nextPage() {
  if (offset.value + limit >= total.value) return
  offset.value += limit
  await loadCatalog()
}

async function prevPage() {
  if (offset.value === 0) return
  offset.value = Math.max(0, offset.value - limit)
  await loadCatalog()
}
</script>

<template>
  <div>
    <p class="settings-group-label">{{ t('settings.reader.feeds.title') }}</p>
    <p class="settings-hint mb-4">{{ t('settings.reader.feeds.hint') }}</p>

    <div class="mb-4 flex flex-col gap-2 md:flex-row">
      <div class="relative flex-1">
        <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="query"
          type="search"
          class="input-field w-full pl-9"
          :placeholder="t('settings.reader.feeds.searchPlaceholder')"
          @keydown.enter.prevent="search"
        />
      </div>
      <Button variant="outline" @click="search">{{ t('common.search') }}</Button>
    </div>

    <div v-if="loading" class="settings-loading-state">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="settings-error-state">{{ error }}</div>
    <div v-else-if="items.length === 0" class="rounded-lg border border-dashed border-border px-5 py-8 text-center text-muted-foreground">
      {{ t('settings.reader.feeds.empty') }}
    </div>
    <div v-else class="space-y-2">
      <div v-for="item in items" :key="item.bookId" class="rounded-lg border border-border bg-card px-4 py-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <Podcast class="size-4 shrink-0 text-muted-foreground" />
              <p class="truncate text-sm font-medium">{{ item.title }}</p>
            </div>
            <p v-if="item.authors.length" class="mt-0.5 truncate text-xs text-muted-foreground">
              {{ item.authors.join(', ') }}
            </p>
          </div>
          <ToggleSwitch
            :model-value="item.feedEnabled"
            :disabled="togglingIds.has(item.bookId)"
            class="shrink-0"
            @update:model-value="toggleFeed(item)"
          />
        </div>
        <div v-if="item.feedEnabled && item.publicId" class="mt-3 flex items-center gap-2">
          <code class="min-w-0 flex-1 truncate rounded bg-muted px-3 py-2 font-mono text-xs">{{ displayUrl(item) }}</code>
          <Button variant="outline" size="sm" class="shrink-0" @click="copyFeedUrl(item)">
            <Copy :size="12" />
            {{ t('settings.reader.feeds.copy') }}
          </Button>
        </div>
      </div>
    </div>

    <div v-if="total > limit" class="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <Button variant="ghost" size="sm" :disabled="offset === 0 || loading" @click="prevPage">
        {{ t('common.previous') }}
      </Button>
      <span>{{ offset + 1 }}–{{ Math.min(offset + limit, total) }} / {{ total }}</span>
      <Button variant="ghost" size="sm" :disabled="offset + limit >= total || loading" @click="nextPage">
        {{ t('common.next') }}
      </Button>
    </div>
  </div>
</template>
