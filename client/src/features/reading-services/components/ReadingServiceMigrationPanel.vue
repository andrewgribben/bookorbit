<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2, Loader2, XCircle } from '@lucide/vue'
import type { ReadingServiceProvider, ReadingServiceSummary } from '@bookorbit/types'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { usePermissions } from '@/features/auth/composables/usePermissions'
import { Permission } from '@bookorbit/types'
import { useExternalBookRequests, type ExternalBookRequestCandidate } from '@/features/book-requests/composables/useExternalBookRequests'
import { useReadingServiceMigration } from '../composables/useReadingServiceMigration'

const props = defineProps<{
  provider: ReadingServiceProvider
  summary: ReadingServiceSummary | null
}>()

const { t } = useI18n()
const { hasPermission } = usePermissions()
const {
  preview,
  run,
  previewing,
  starting,
  cancelling,
  resuming,
  error,
  readwiseOnlyBooks,
  readwiseOnlyTotal,
  readwiseOnlyNextOffset,
  loadingReadwiseOnlyBooks,
  trackRun,
  runPreview,
  startMigration,
  resumeMigration,
  cancelMigration,
  loadReadwiseOnlyBooks,
} = useReadingServiceMigration(props.provider)

const canRequestBooks = computed(() => hasPermission(Permission.BookRequestAccess))
const { stateFor, errorFor, checkMany, requestOne, requestAll } = useExternalBookRequests()

const providerLabel = props.provider.charAt(0).toUpperCase() + props.provider.slice(1)

function ownershipLabel(book: { ownership: 'owned' | 'not_owned' | 'unknown' }): string {
  return t(`settings.readingServices.migration.readwiseOnlyList.ownership.${book.ownership}`)
}

function handleLoadMoreReadwiseOnlyBooks(): void {
  void loadReadwiseOnlyBooks()
}

function candidateFor(book: { externalId: string; title: string | null; author: string | null; coverImageUrl: string | null }): ExternalBookRequestCandidate {
  return { externalId: book.externalId, title: book.title, author: book.author, coverUrl: book.coverImageUrl }
}

watch(
  readwiseOnlyBooks,
  (books) => {
    if (canRequestBooks.value && books.length > 0) void checkMany(books.map(candidateFor))
  },
  { immediate: true },
)

const requestAllOpen = ref(false)
const requestingAll = ref(false)
const requestAllOutcome = ref<string | null>(null)

const requestableBooks = computed(() => readwiseOnlyBooks.value.filter((book) => stateFor(book.externalId) === 'requestable'))

function openRequestAll(): void {
  requestAllOutcome.value = null
  requestAllOpen.value = true
}

async function confirmRequestAll(): Promise<void> {
  requestingAll.value = true
  try {
    const result = await requestAll(requestableBooks.value.map(candidateFor))
    requestAllOutcome.value = t('bookRequests.externalRequest.requestAllResult', {
      created: result.created,
      skipped: result.skipped,
      errors: result.errors,
    })
  } finally {
    requestingAll.value = false
    requestAllOpen.value = false
  }
}

onMounted(() => {
  const migration = props.summary?.migration
  if (migration?.runId && migration.state === 'running') {
    trackRun({
      id: migration.runId,
      provider: props.provider,
      kind: 'migration',
      status: 'running',
      counters: { scanned: 0, matched: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
    })
  } else if (migration?.state === 'done') {
    void loadReadwiseOnlyBooks(true)
  }
})
</script>

<template>
  <div class="border border-border rounded-lg bg-card px-4 py-4 md:px-5 md:py-5 shadow-xs space-y-4">
    <div>
      <p class="font-medium text-sm">{{ t('settings.readingServices.migration.title') }}</p>
      <p class="text-xs text-muted-foreground mt-0.5">{{ t('settings.readingServices.migration.subtitle', { provider: providerLabel }) }}</p>
    </div>

    <div v-if="error" class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2">
      <AlertCircle class="size-3.5 shrink-0 text-destructive mt-0.5" />
      <p class="text-xs text-destructive leading-relaxed">{{ error }}</p>
    </div>

    <!-- Failed -->
    <template v-if="run?.status === 'failed'">
      <div class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2">
        <AlertCircle class="size-3.5 shrink-0 text-destructive mt-0.5" />
        <p class="text-xs text-destructive leading-relaxed">{{ run.error ?? t('settings.readingServices.migration.failedTitle') }}</p>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div v-for="key in ['updated', 'created', 'skipped', 'failed'] as const" :key="key" class="rounded-md border border-border px-3 py-2">
          <p class="text-lg font-semibold tabular-nums text-right">{{ run.counters[key] }}</p>
          <p class="text-xs text-muted-foreground text-right">{{ t(`settings.readingServices.migration.counters.${key}`) }}</p>
        </div>
      </div>
      <div class="flex justify-end pt-2 border-t border-border">
        <Button size="sm" type="button" :disabled="resuming" @click="resumeMigration">
          <Loader2 v-if="resuming" class="size-3.5 animate-spin" />
          {{ resuming ? t('settings.readingServices.migration.resumingButton') : t('settings.readingServices.migration.resumeButton') }}
        </Button>
      </div>
    </template>

    <!-- Running -->
    <template v-else-if="run?.status === 'running'">
      <p class="text-xs text-muted-foreground">
        {{
          run.phase === 'reconciling'
            ? t('settings.readingServices.migration.reconcilingDescription', { provider: providerLabel })
            : t('settings.readingServices.migration.runningDescription')
        }}
      </p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div v-for="key in ['updated', 'created', 'skipped', 'failed'] as const" :key="key" class="rounded-md border border-border px-3 py-2">
          <p class="text-lg font-semibold tabular-nums text-right">{{ run.counters[key] }}</p>
          <p class="text-xs text-muted-foreground text-right">{{ t(`settings.readingServices.migration.counters.${key}`) }}</p>
        </div>
      </div>
      <div class="flex justify-end pt-2 border-t border-border">
        <Button variant="outline" size="sm" type="button" :disabled="cancelling" @click="cancelMigration">
          <Loader2 v-if="cancelling" class="size-3.5 animate-spin" />
          <XCircle v-else class="size-3.5" />
          {{ cancelling ? t('settings.readingServices.migration.cancellingButton') : t('settings.readingServices.migration.cancelButton') }}
        </Button>
      </div>
    </template>

    <!-- Completed -->
    <template v-else-if="run?.status === 'completed'">
      <div class="flex items-center gap-1.5 text-xs text-primary">
        <CheckCircle2 class="size-3.5" />
        {{ t('settings.readingServices.migration.completedTitle') }}
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div v-for="key in ['updated', 'created', 'skipped', 'failed'] as const" :key="key" class="rounded-md border border-border px-3 py-2">
          <p class="text-lg font-semibold tabular-nums text-right">{{ run.counters[key] }}</p>
          <p class="text-xs text-muted-foreground text-right">{{ t(`settings.readingServices.migration.counters.${key}`) }}</p>
        </div>
      </div>
      <div class="flex justify-end pt-2 border-t border-border">
        <Button variant="outline" size="sm" type="button" :disabled="starting" @click="startMigration">
          <Loader2 v-if="starting" class="size-3.5 animate-spin" />
          {{ t('settings.readingServices.migration.runAgainButton') }}
        </Button>
      </div>
    </template>

    <!-- Previewed, not yet started -->
    <template v-else-if="preview">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="rounded-md border border-border px-3 py-2">
          <p class="text-lg font-semibold tabular-nums text-right">{{ preview.matched }}</p>
          <p class="text-xs text-muted-foreground text-right">
            {{ t('settings.readingServices.migration.previewMatched', { provider: providerLabel }) }}
          </p>
        </div>
        <div class="rounded-md border border-border px-3 py-2">
          <p class="text-lg font-semibold tabular-nums text-right">{{ preview.toCreate }}</p>
          <p class="text-xs text-muted-foreground text-right">
            {{ t('settings.readingServices.migration.previewToCreate', { provider: providerLabel }) }}
          </p>
        </div>
        <div class="rounded-md border border-border px-3 py-2">
          <p class="text-lg font-semibold tabular-nums text-right">{{ preview.readwiseOnly }}</p>
          <p class="text-xs text-muted-foreground text-right">
            {{ t('settings.readingServices.migration.previewReadwiseOnly', { provider: providerLabel }) }}
          </p>
        </div>
      </div>
      <p class="text-xs text-muted-foreground">{{ t('settings.readingServices.migration.previewNote', { provider: providerLabel }) }}</p>
      <div class="flex justify-end gap-2 pt-2 border-t border-border">
        <Button variant="outline" size="sm" type="button" :disabled="previewing" @click="runPreview">
          <Loader2 v-if="previewing" class="size-3.5 animate-spin" />
          {{ previewing ? t('settings.readingServices.migration.previewingButton') : t('settings.readingServices.migration.previewAgainButton') }}
        </Button>
        <Button size="sm" type="button" :disabled="starting" @click="startMigration">
          <Loader2 v-if="starting" class="size-3.5 animate-spin" />
          {{ starting ? t('settings.readingServices.migration.startingButton') : t('settings.readingServices.migration.startButton') }}
        </Button>
      </div>
    </template>

    <!-- Never run -->
    <template v-else>
      <p class="text-xs text-muted-foreground">{{ t('settings.readingServices.migration.neverRunDescription', { provider: providerLabel }) }}</p>
      <div class="flex justify-end pt-2 border-t border-border">
        <Button size="sm" type="button" :disabled="previewing" @click="runPreview">
          <Loader2 v-if="previewing" class="size-3.5 animate-spin" />
          {{ previewing ? t('settings.readingServices.migration.previewingButton') : t('settings.readingServices.migration.previewButton') }}
        </Button>
      </div>
    </template>

    <!-- Readwise-only books list -->
    <div v-if="readwiseOnlyBooks.length > 0" class="pt-3 border-t border-border space-y-2">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="font-medium text-sm">{{ t('settings.readingServices.migration.readwiseOnlyList.title', { provider: providerLabel }) }}</p>
          <p class="text-xs text-muted-foreground mt-0.5">
            {{ t('settings.readingServices.migration.readwiseOnlyList.subtitle', { provider: providerLabel }) }}
          </p>
        </div>
        <Button
          v-if="canRequestBooks && requestableBooks.length > 0"
          variant="outline"
          size="sm"
          type="button"
          :disabled="requestingAll"
          @click="openRequestAll"
        >
          {{ t('bookRequests.externalRequest.requestAllButton') }}
        </Button>
      </div>
      <p v-if="requestAllOutcome" class="text-xs text-muted-foreground">{{ requestAllOutcome }}</p>
      <div class="divide-y divide-border rounded-md border border-border">
        <div v-for="book in readwiseOnlyBooks" :key="book.externalId" class="flex items-center gap-3 px-3 py-2">
          <span class="w-9 h-12 rounded-sm bg-muted overflow-hidden shrink-0 border border-border">
            <img v-if="book.coverImageUrl" :src="book.coverImageUrl" :alt="book.title ?? ''" class="w-full h-full object-cover" />
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ book.title ?? t('settings.readingServices.migration.readwiseOnlyList.untitled') }}</p>
            <p class="text-xs text-muted-foreground truncate">{{ book.author }}</p>
            <p v-if="stateFor(book.externalId) === 'error'" class="text-xs text-destructive truncate">{{ errorFor(book.externalId) }}</p>
          </div>
          <span class="text-xs text-muted-foreground whitespace-nowrap">{{ ownershipLabel(book) }}</span>
          <Button
            v-if="canRequestBooks && stateFor(book.externalId) !== 'owned'"
            variant="outline"
            size="sm"
            type="button"
            :disabled="stateFor(book.externalId) === 'checking' || stateFor(book.externalId) === 'requesting' || stateFor(book.externalId) === 'requested' || stateFor(book.externalId) === 'already-requested'"
            @click="requestOne(candidateFor(book))"
          >
            <Loader2 v-if="stateFor(book.externalId) === 'checking' || stateFor(book.externalId) === 'requesting'" class="size-3.5 animate-spin" />
            <CheckCircle2 v-else-if="stateFor(book.externalId) === 'requested'" class="size-3.5" />
            {{
              stateFor(book.externalId) === 'checking'
                ? t('bookRequests.externalRequest.checkingButton')
                : stateFor(book.externalId) === 'requesting'
                  ? t('bookRequests.externalRequest.requestingButton')
                  : stateFor(book.externalId) === 'requested'
                    ? t('bookRequests.externalRequest.requestedButton')
                    : stateFor(book.externalId) === 'already-requested'
                      ? t('bookRequests.externalRequest.alreadyRequestedButton')
                      : stateFor(book.externalId) === 'error'
                        ? t('bookRequests.externalRequest.errorButton')
                        : t('bookRequests.externalRequest.requestButton')
            }}
          </Button>
        </div>
      </div>
      <div class="flex items-center justify-between">
        <p class="text-xs text-muted-foreground">
          {{ t('settings.readingServices.migration.readwiseOnlyList.count', { shown: readwiseOnlyBooks.length, total: readwiseOnlyTotal }) }}
        </p>
        <Button
          v-if="readwiseOnlyNextOffset !== null"
          variant="outline"
          size="sm"
          type="button"
          :disabled="loadingReadwiseOnlyBooks"
          @click="handleLoadMoreReadwiseOnlyBooks"
        >
          <Loader2 v-if="loadingReadwiseOnlyBooks" class="size-3.5 animate-spin" />
          {{ t('settings.readingServices.migration.readwiseOnlyList.loadMoreButton') }}
        </Button>
      </div>
    </div>
  </div>

  <ConfirmDialog
    :open="requestAllOpen"
    :title="t('bookRequests.externalRequest.requestAllConfirmTitle', { count: requestableBooks.length })"
    :description="t('bookRequests.externalRequest.requestAllConfirmDescription', { count: requestableBooks.length })"
    :confirm-label="t('bookRequests.externalRequest.requestAllConfirmLabel', { count: requestableBooks.length })"
    :busy="requestingAll"
    :destructive="false"
    @confirm="confirmRequestAll"
    @cancel="requestAllOpen = false"
  />
</template>
