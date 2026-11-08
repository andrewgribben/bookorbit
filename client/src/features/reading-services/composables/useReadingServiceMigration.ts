import { onUnmounted, ref } from 'vue'
import type { ReadingServiceProvider, ReadingServiceRemoteOnlyBook, SyncRunProgress } from '@bookorbit/types'
import {
  cancelReadingServiceRun,
  fetchReadingServiceRun,
  fetchReadwiseOnlyBooks,
  previewReadingServiceMigration,
  resumeReadingServiceMigration,
  startReadingServiceMigration,
  type MigrationPreview,
} from '../api/reading-services.api'

const POLL_INTERVAL_MS = 2000
const READWISE_ONLY_PAGE_SIZE = 50

/**
 * One instance per mounted migration panel. State isn't module-level shared state (unlike
 * useReadingServices) because only one panel per provider is ever on screen at a time.
 */
export function useReadingServiceMigration(provider: ReadingServiceProvider) {
  const preview = ref<MigrationPreview | null>(null)
  const run = ref<SyncRunProgress | null>(null)
  const previewing = ref(false)
  const starting = ref(false)
  const cancelling = ref(false)
  const resuming = ref(false)
  const error = ref<string | null>(null)

  const readwiseOnlyBooks = ref<ReadingServiceRemoteOnlyBook[]>([])
  const readwiseOnlyTotal = ref(0)
  const readwiseOnlyNextOffset = ref<number | null>(0)
  const loadingReadwiseOnlyBooks = ref(false)

  let pollTimer: ReturnType<typeof setInterval> | null = null

  function stopPolling(): void {
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function startPolling(runId: number): void {
    stopPolling()
    pollTimer = setInterval(async () => {
      try {
        const latest = await fetchReadingServiceRun(runId)
        run.value = latest
        if (latest.status !== 'running') {
          stopPolling()
          if (latest.status === 'completed') void loadReadwiseOnlyBooks(true)
        }
      } catch {
        stopPolling()
      }
    }, POLL_INTERVAL_MS)
  }

  /** Call once after GET /reading-services resolves, to resume polling an already-running run. */
  function trackRun(progress: SyncRunProgress | null): void {
    run.value = progress
    if (progress && progress.status === 'running') startPolling(progress.id)
    if (progress && progress.status === 'completed') void loadReadwiseOnlyBooks(true)
  }

  async function runPreview(): Promise<void> {
    previewing.value = true
    error.value = null
    try {
      preview.value = await previewReadingServiceMigration(provider)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to preview migration'
    } finally {
      previewing.value = false
    }
  }

  async function startMigration(): Promise<void> {
    starting.value = true
    error.value = null
    try {
      const progress = await startReadingServiceMigration(provider)
      run.value = progress
      if (progress.status === 'running') startPolling(progress.id)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start migration'
    } finally {
      starting.value = false
    }
  }

  async function resumeMigration(): Promise<void> {
    const current = run.value
    if (!current) return
    resuming.value = true
    error.value = null
    try {
      const progress = await resumeReadingServiceMigration(current.id)
      run.value = progress
      if (progress.status === 'running') startPolling(progress.id)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to resume migration'
    } finally {
      resuming.value = false
    }
  }

  async function cancelMigration(): Promise<void> {
    const current = run.value
    if (!current) return
    cancelling.value = true
    error.value = null
    try {
      run.value = await cancelReadingServiceRun(current.id)
      stopPolling()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to cancel migration'
    } finally {
      cancelling.value = false
    }
  }

  async function loadReadwiseOnlyBooks(reset = false): Promise<void> {
    if (reset) {
      readwiseOnlyBooks.value = []
      readwiseOnlyNextOffset.value = 0
    }
    if (readwiseOnlyNextOffset.value === null || loadingReadwiseOnlyBooks.value) return
    loadingReadwiseOnlyBooks.value = true
    try {
      const page = await fetchReadwiseOnlyBooks(provider, readwiseOnlyNextOffset.value, READWISE_ONLY_PAGE_SIZE)
      readwiseOnlyBooks.value = [...readwiseOnlyBooks.value, ...page.items]
      readwiseOnlyTotal.value = page.total
      readwiseOnlyNextOffset.value = page.next
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load provider-only books'
    } finally {
      loadingReadwiseOnlyBooks.value = false
    }
  }

  onUnmounted(() => {
    stopPolling()
  })

  return {
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
    stopPolling,
  }
}
