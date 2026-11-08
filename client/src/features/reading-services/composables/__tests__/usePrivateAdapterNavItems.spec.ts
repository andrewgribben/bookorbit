import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import type { ReadingServiceSummary } from '@bookorbit/types'
import { usePrivateAdapterNavItems } from '../usePrivateAdapterNavItems'

const summaries = ref<ReadingServiceSummary[]>([])
const fetchSummaries = vi.fn<(...args: unknown[]) => unknown>()

vi.mock('../useReadingServices', () => ({
  useReadingServices: () => ({ summaries, fetchSummaries }),
}))

function summary(overrides: Partial<ReadingServiceSummary>): ReadingServiceSummary {
  return {
    provider: 'readwise',
    connected: false,
    capabilities: {},
    features: {},
    migration: { state: 'never', runId: null, finishedAt: null },
    lastPullAt: null,
    disabledReason: null,
    libraries: [],
    ...overrides,
  } as ReadingServiceSummary
}

/** `usePrivateAdapterNavItems` calls `onMounted`, so it needs a real component instance. */
function withSetup() {
  let result!: ReturnType<typeof usePrivateAdapterNavItems>
  const wrapper = mount(
    defineComponent({
      setup() {
        result = usePrivateAdapterNavItems()
        return () => null
      },
    }),
  )
  return { result, wrapper }
}

describe('usePrivateAdapterNavItems', () => {
  beforeEach(() => {
    summaries.value = []
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('lists only private adapters (ones declaring authMethods), not the built-ins', () => {
    summaries.value = [
      summary({ provider: 'readwise', authMethods: undefined }),
      summary({ provider: 'hardcover', authMethods: undefined }),
      summary({
        provider: 'fixturewise' as ReadingServiceSummary['provider'],
        displayName: 'Fixturewise',
        iconUrl: null,
        authMethods: [{ kind: 'token', label: 'API token' }],
      }),
    ]

    const { result } = withSetup()

    expect(result.items.value).toHaveLength(1)
    expect(result.items.value[0]).toMatchObject({
      routeName: 'settings-reading-service',
      routeParams: { provider: 'fixturewise' },
      labelKey: 'Fixturewise',
    })
  })

  it('falls back to the provider id when a private adapter has no displayName', () => {
    summaries.value = [
      summary({
        provider: 'barewise' as ReadingServiceSummary['provider'],
        displayName: undefined,
        authMethods: [{ kind: 'token', label: 'API token' }],
      }),
    ]

    const { result } = withSetup()

    expect(result.items.value[0]?.labelKey).toBe('barewise')
  })

  it('fetches summaries once on mount so the nav reflects adapters without a manual refresh', () => {
    withSetup()
    expect(fetchSummaries).toHaveBeenCalledTimes(1)
  })
})
