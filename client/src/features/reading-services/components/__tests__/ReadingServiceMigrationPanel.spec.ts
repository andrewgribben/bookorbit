import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import type { SyncRunProgress } from '@bookorbit/types'
import ReadingServiceMigrationPanel from '../ReadingServiceMigrationPanel.vue'

const preview = ref<{ matched: number; toCreate: number; readwiseOnly: number } | null>(null)
const run = ref<SyncRunProgress | null>(null)
const previewing = ref(false)
const starting = ref(false)
const cancelling = ref(false)
const error = ref<string | null>(null)

const mocks = vi.hoisted(() => ({
  trackRun: vi.fn(),
  runPreview: vi.fn<() => Promise<void>>(),
  startMigration: vi.fn<() => Promise<void>>(),
  cancelMigration: vi.fn<() => Promise<void>>(),
}))

vi.mock('../../composables/useReadingServiceMigration', () => ({
  useReadingServiceMigration: () => ({
    preview,
    run,
    previewing,
    starting,
    cancelling,
    error,
    trackRun: mocks.trackRun,
    runPreview: mocks.runPreview,
    startMigration: mocks.startMigration,
    cancelMigration: mocks.cancelMigration,
  }),
}))

function makeRun(overrides: Partial<SyncRunProgress> = {}): SyncRunProgress {
  return {
    id: 1,
    provider: 'readwise',
    kind: 'migration',
    status: 'running',
    counters: { scanned: 0, matched: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
    ...overrides,
  }
}

const baseSummary = {
  provider: 'readwise' as const,
  connected: true,
  capabilities: { status: 'both' as const },
  features: {},
  migration: { state: 'never' as const, runId: null, finishedAt: null },
  lastPullAt: null,
  disabledReason: null,
}

beforeEach(() => {
  preview.value = null
  run.value = null
  previewing.value = false
  starting.value = false
  cancelling.value = false
  error.value = null
  vi.clearAllMocks()
})

describe('ReadingServiceMigrationPanel', () => {
  it('shows a preview button when migration has never run', () => {
    const wrapper = mount(ReadingServiceMigrationPanel, { props: { provider: 'readwise', summary: baseSummary } })
    expect(wrapper.text()).toContain('Preview migration')
  })

  it('calls runPreview when the preview button is clicked', async () => {
    const wrapper = mount(ReadingServiceMigrationPanel, { props: { provider: 'readwise', summary: baseSummary } })
    await wrapper.get('button').trigger('click')
    expect(mocks.runPreview).toHaveBeenCalledTimes(1)
  })

  it('shows preview counts and a start button once previewed', () => {
    preview.value = { matched: 10, toCreate: 5, readwiseOnly: 2 }
    const wrapper = mount(ReadingServiceMigrationPanel, { props: { provider: 'readwise', summary: baseSummary } })
    expect(wrapper.text()).toContain('10')
    expect(wrapper.text()).toContain('5')
    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('Start migration')
  })

  it('shows live counters and a cancel button while running', () => {
    run.value = makeRun({ status: 'running', counters: { scanned: 10, matched: 4, created: 3, updated: 2, skipped: 1, failed: 0 } })
    const wrapper = mount(ReadingServiceMigrationPanel, { props: { provider: 'readwise', summary: baseSummary } })
    expect(wrapper.text()).toContain('Cancel')
    expect(wrapper.text()).toContain('2') // updated
    expect(wrapper.text()).toContain('3') // created
  })

  it('calls cancelMigration when cancel is clicked while running', async () => {
    run.value = makeRun({ status: 'running' })
    const wrapper = mount(ReadingServiceMigrationPanel, { props: { provider: 'readwise', summary: baseSummary } })
    await wrapper.get('button').trigger('click')
    expect(mocks.cancelMigration).toHaveBeenCalledTimes(1)
  })

  it('shows a completed summary with a run-again button', () => {
    run.value = makeRun({ status: 'completed', finishedAt: new Date().toISOString() })
    const wrapper = mount(ReadingServiceMigrationPanel, { props: { provider: 'readwise', summary: baseSummary } })
    expect(wrapper.text()).toContain('Migration completed')
    expect(wrapper.text()).toContain('Run again')
  })

  it('shows the failure reason and a retry button when failed', () => {
    run.value = makeRun({ status: 'failed', error: 'Readwise returned 429 (rate limited)' })
    const wrapper = mount(ReadingServiceMigrationPanel, { props: { provider: 'readwise', summary: baseSummary } })
    expect(wrapper.text()).toContain('Readwise returned 429 (rate limited)')
    expect(wrapper.text()).toContain('Retry migration')
  })

  it('resumes polling an already-running run reported by the summary on mount', () => {
    const summaryWithRun = { ...baseSummary, migration: { state: 'running' as const, runId: 42, finishedAt: null } }
    mount(ReadingServiceMigrationPanel, { props: { provider: 'readwise', summary: summaryWithRun } })
    expect(mocks.trackRun).toHaveBeenCalledTimes(1)
    expect(mocks.trackRun.mock.calls[0]?.[0]).toMatchObject({ id: 42, status: 'running' })
  })
})
