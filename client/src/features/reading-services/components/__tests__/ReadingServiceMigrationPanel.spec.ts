import { describe, expect, it, vi, beforeEach } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import type { ReadingServiceRemoteOnlyBook, SyncRunProgress } from '@bookorbit/types'
import ReadingServiceMigrationPanel from '../ReadingServiceMigrationPanel.vue'

const ConfirmDialogStub = defineComponent({
  name: 'ConfirmDialog',
  props: {
    title: { type: String, required: true },
    description: { type: String, required: true },
    confirmLabel: { type: String, required: true },
    open: Boolean,
    busy: Boolean,
  },
  emits: ['confirm', 'cancel'],
  template: `
    <div v-if="open">
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
      <button type="button" :disabled="busy" @click="$emit('cancel')">Cancel</button>
      <button type="button" :disabled="busy" @click="$emit('confirm')">{{ confirmLabel }}</button>
    </div>
  `,
})

const preview = ref<{ matched: number; toCreate: number; readwiseOnly: number } | null>(null)
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

const mocks = vi.hoisted(() => ({
  trackRun: vi.fn(),
  runPreview: vi.fn<() => Promise<void>>(),
  startMigration: vi.fn<() => Promise<void>>(),
  resumeMigration: vi.fn<() => Promise<void>>(),
  cancelMigration: vi.fn<() => Promise<void>>(),
  loadReadwiseOnlyBooks: vi.fn<() => Promise<void>>(),
  hasPermission: vi.fn().mockReturnValue(false),
  stateFor: vi.fn().mockReturnValue('requestable'),
  errorFor: vi.fn().mockReturnValue(null),
  checkMany: vi.fn<() => Promise<void>>(),
  requestOne: vi.fn<() => Promise<void>>(),
  requestAll: vi.fn<() => Promise<{ created: number; skipped: number; errors: number; results: never[] }>>(),
}))

vi.mock('../../composables/useReadingServiceMigration', () => ({
  useReadingServiceMigration: () => ({
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
    trackRun: mocks.trackRun,
    runPreview: mocks.runPreview,
    startMigration: mocks.startMigration,
    resumeMigration: mocks.resumeMigration,
    cancelMigration: mocks.cancelMigration,
    loadReadwiseOnlyBooks: mocks.loadReadwiseOnlyBooks,
  }),
}))

vi.mock('@/features/auth/composables/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: mocks.hasPermission }),
}))

vi.mock('@/features/book-requests/composables/useExternalBookRequests', () => ({
  useExternalBookRequests: () => ({
    stateFor: mocks.stateFor,
    errorFor: mocks.errorFor,
    checkMany: mocks.checkMany,
    requestOne: mocks.requestOne,
    requestAll: mocks.requestAll,
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
  libraries: [],
}

function mountPanel(props: { provider: 'readwise'; summary: typeof baseSummary }) {
  return mount(ReadingServiceMigrationPanel, { props, global: { stubs: { ConfirmDialog: ConfirmDialogStub } } })
}

beforeEach(() => {
  preview.value = null
  run.value = null
  previewing.value = false
  starting.value = false
  cancelling.value = false
  resuming.value = false
  error.value = null
  readwiseOnlyBooks.value = []
  readwiseOnlyTotal.value = 0
  readwiseOnlyNextOffset.value = 0
  loadingReadwiseOnlyBooks.value = false
  vi.clearAllMocks()
  mocks.hasPermission.mockReturnValue(false)
  mocks.stateFor.mockReturnValue('requestable')
  mocks.errorFor.mockReturnValue(null)
})

describe('ReadingServiceMigrationPanel', () => {
  it('shows a preview button when migration has never run', () => {
    const wrapper = mountPanel({ provider: 'readwise', summary: baseSummary })
    expect(wrapper.text()).toContain('Preview migration')
  })

  it('calls runPreview when the preview button is clicked', async () => {
    const wrapper = mountPanel({ provider: 'readwise', summary: baseSummary })
    await wrapper.get('button').trigger('click')
    expect(mocks.runPreview).toHaveBeenCalledTimes(1)
  })

  it('shows preview counts and a start button once previewed', () => {
    preview.value = { matched: 10, toCreate: 5, readwiseOnly: 2 }
    const wrapper = mountPanel({ provider: 'readwise', summary: baseSummary })
    expect(wrapper.text()).toContain('10')
    expect(wrapper.text()).toContain('5')
    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('Start migration')
  })

  it('shows live counters and a cancel button while running', () => {
    run.value = makeRun({ status: 'running', counters: { scanned: 10, matched: 4, created: 3, updated: 2, skipped: 1, failed: 0 } })
    const wrapper = mountPanel({ provider: 'readwise', summary: baseSummary })
    expect(wrapper.text()).toContain('Cancel')
    expect(wrapper.text()).toContain('2') // updated
    expect(wrapper.text()).toContain('3') // created
  })

  it('calls cancelMigration when cancel is clicked while running', async () => {
    run.value = makeRun({ status: 'running' })
    const wrapper = mountPanel({ provider: 'readwise', summary: baseSummary })
    await wrapper.get('button').trigger('click')
    expect(mocks.cancelMigration).toHaveBeenCalledTimes(1)
  })

  it('shows a reconciling message instead of the normal running description while reconciling', () => {
    run.value = makeRun({ status: 'running', phase: 'reconciling' })
    const wrapper = mountPanel({ provider: 'readwise', summary: baseSummary })
    expect(wrapper.text()).toContain("Checking what's already on Readwise")
    expect(wrapper.text()).not.toContain('This can take a while for a large library')
  })

  it('shows a completed summary with a run-again button', () => {
    run.value = makeRun({ status: 'completed', finishedAt: new Date().toISOString() })
    const wrapper = mountPanel({ provider: 'readwise', summary: baseSummary })
    expect(wrapper.text()).toContain('Migration completed')
    expect(wrapper.text()).toContain('Run again')
  })

  it('shows the failure reason and a resume button when failed', () => {
    run.value = makeRun({ status: 'failed', error: 'Readwise returned 429 (rate limited)' })
    const wrapper = mountPanel({ provider: 'readwise', summary: baseSummary })
    expect(wrapper.text()).toContain('Readwise returned 429 (rate limited)')
    expect(wrapper.text()).toContain('Resume migration')
  })

  it('calls resumeMigration when resume is clicked while failed', async () => {
    run.value = makeRun({ status: 'failed', error: 'rate limited' })
    const wrapper = mountPanel({ provider: 'readwise', summary: baseSummary })
    await wrapper.get('button').trigger('click')
    expect(mocks.resumeMigration).toHaveBeenCalledTimes(1)
  })

  it('resumes polling an already-running run reported by the summary on mount', () => {
    const summaryWithRun = { ...baseSummary, migration: { state: 'running' as const, runId: 42, finishedAt: null } }
    mountPanel({ provider: 'readwise', summary: summaryWithRun })
    expect(mocks.trackRun).toHaveBeenCalledTimes(1)
    expect(mocks.trackRun.mock.calls[0]?.[0]).toMatchObject({ id: 42, status: 'running' })
  })

  it('loads the readwise-only books list on mount when a migration has already completed', () => {
    const summaryWithDoneMigration = { ...baseSummary, migration: { state: 'done' as const, runId: 1, finishedAt: new Date().toISOString() } }
    mountPanel({ provider: 'readwise', summary: summaryWithDoneMigration })
    expect(mocks.loadReadwiseOnlyBooks).toHaveBeenCalledWith(true)
  })

  it('renders the readwise-only books list with title, author and ownership', () => {
    readwiseOnlyBooks.value = [
      { externalId: 'r1', title: 'Piranesi', author: 'Susanna Clarke', coverImageUrl: null, ownership: 'owned', externalUrl: null },
    ]
    readwiseOnlyTotal.value = 1
    readwiseOnlyNextOffset.value = null
    const wrapper = mountPanel({ provider: 'readwise', summary: baseSummary })
    expect(wrapper.text()).toContain('Piranesi')
    expect(wrapper.text()).toContain('Susanna Clarke')
    expect(wrapper.text()).toContain('Owned')
  })

  it('shows a load-more button only while another page remains', () => {
    readwiseOnlyBooks.value = [{ externalId: 'r1', title: 'A', author: null, coverImageUrl: null, ownership: 'unknown', externalUrl: null }]
    readwiseOnlyTotal.value = 2
    readwiseOnlyNextOffset.value = 50
    const wrapper = mountPanel({ provider: 'readwise', summary: baseSummary })
    expect(wrapper.text()).toContain('Load more')
  })

  describe('requesting a readwise-only book', () => {
    function withOneBook() {
      readwiseOnlyBooks.value = [
        { externalId: 'r1', title: 'Piranesi', author: 'Susanna Clarke', coverImageUrl: null, ownership: 'not_owned', externalUrl: null },
      ]
      readwiseOnlyTotal.value = 1
      readwiseOnlyNextOffset.value = null
    }

    it('hides the per-row Request button without the book-request permission', () => {
      mocks.hasPermission.mockReturnValue(false)
      withOneBook()
      const wrapper = mountPanel({ provider: 'readwise', summary: baseSummary })
      expect(wrapper.text()).not.toContain('Request')
    })

    it('hides the Request all button without the permission even with requestable rows', () => {
      mocks.hasPermission.mockReturnValue(false)
      withOneBook()
      const wrapper = mountPanel({ provider: 'readwise', summary: baseSummary })
      expect(wrapper.text()).not.toContain('Request all')
    })

    it('shows a Request button per row with the permission and calls requestOne on click', async () => {
      mocks.hasPermission.mockReturnValue(true)
      withOneBook()
      const wrapper = mountPanel({ provider: 'readwise', summary: baseSummary })
      expect(mocks.checkMany).toHaveBeenCalled()

      const requestButton = wrapper.findAll('button').find((button) => button.text() === 'Request')
      expect(requestButton).toBeDefined()
      await requestButton!.trigger('click')
      expect(mocks.requestOne).toHaveBeenCalledWith(expect.objectContaining({ externalId: 'r1', title: 'Piranesi', author: 'Susanna Clarke' }))
    })

    it('disables the row button and shows the already-requested label for a row already requested', () => {
      mocks.hasPermission.mockReturnValue(true)
      mocks.stateFor.mockReturnValue('already-requested')
      withOneBook()
      const wrapper = mountPanel({ provider: 'readwise', summary: baseSummary })
      expect(wrapper.text()).toContain('Already requested')
    })

    it('shows the row error text when a request failed', () => {
      mocks.hasPermission.mockReturnValue(true)
      mocks.stateFor.mockReturnValue('error')
      mocks.errorFor.mockReturnValue('Title is required')
      withOneBook()
      const wrapper = mountPanel({ provider: 'readwise', summary: baseSummary })
      expect(wrapper.text()).toContain('Title is required')
    })

    it('opens a confirm dialog naming the count before requesting all, and calls requestAll on confirm', async () => {
      mocks.hasPermission.mockReturnValue(true)
      mocks.requestAll.mockResolvedValue({ created: 1, skipped: 0, errors: 0, results: [] })
      withOneBook()
      const wrapper = mountPanel({ provider: 'readwise', summary: baseSummary })

      const requestAllButton = wrapper.findAll('button').find((button) => button.text() === 'Request all')
      expect(requestAllButton).toBeDefined()
      await requestAllButton!.trigger('click')

      expect(wrapper.text()).toContain('Request 1 books?')
      expect(mocks.requestAll).not.toHaveBeenCalled()

      const confirmButton = wrapper.findAll('button').find((button) => button.text() === 'Request all 1')
      expect(confirmButton).toBeDefined()
      await confirmButton!.trigger('click')

      expect(mocks.requestAll).toHaveBeenCalledTimes(1)
    })
  })
})
