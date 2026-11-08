import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import type { Library } from '@bookorbit/types'
import type { ReadingServiceSummary } from '@bookorbit/types'
import ReadingServiceLibraries from '../ReadingServiceLibraries.vue'

function makeLibrary(overrides: Partial<Library> = {}): Library {
  return {
    id: 1,
    name: 'Books',
    icon: 'BookOpen',
    displayOrder: 0,
    coverAspectRatio: 'book',
    watch: false,
    metadataPrecedence: [],
    formatPriority: [],
    allowedFormats: [],
    organizationMode: 'flat',
    addedAtSource: 'scan',
    excludePatterns: [],
    readingThreshold: 0,
    markAsFinishedPercentComplete: 100,
    fileWriteEnabled: false,
    fileWriteWriteCover: false,
    fileWriteEpubEnabled: false,
    fileWriteEpubMaxFileSizeMb: 0,
    fileWriteFb2Enabled: false,
    ...overrides,
  } as Library
}

const libraries = ref<Library[]>([makeLibrary({ id: 1, name: 'Books' }), makeLibrary({ id: 2, name: 'Comics' })])

const mocks = vi.hoisted(() => ({
  setLibrary: vi.fn<(provider: string, libraryId: number, update: unknown) => Promise<boolean>>().mockResolvedValue(true),
  resetLibrary: vi.fn<(provider: string, libraryId: number) => Promise<boolean>>().mockResolvedValue(true),
}))

const savingLibraryId = ref<number | null>(null)

vi.mock('@/features/library/composables/useLibraries', () => ({
  useLibraries: () => ({ libraries, fetchLibraries: vi.fn() }),
}))

vi.mock('../../composables/useReadingServices', () => ({
  useReadingServices: () => ({
    savingLibraryId,
    setLibrary: mocks.setLibrary,
    resetLibrary: mocks.resetLibrary,
  }),
}))

function makeSummary(overrides: Partial<ReadingServiceSummary> = {}): ReadingServiceSummary {
  return {
    provider: 'hardcover',
    connected: true,
    capabilities: { status: 'both', rating: 'both', dates: 'both' },
    features: {},
    migration: { state: 'never', runId: null, finishedAt: null },
    lastPullAt: null,
    disabledReason: null,
    libraries: [],
    ...overrides,
  }
}

describe('ReadingServiceLibraries', () => {
  it('renders a sync switch for every library and reports "inherits" when there is no override', () => {
    const wrapper = mount(ReadingServiceLibraries, { props: { provider: 'hardcover', summary: makeSummary() } })

    expect(wrapper.text()).toContain('Books')
    expect(wrapper.text()).toContain('Comics')
    expect(wrapper.findAll('[role="switch"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Follows the settings above.')
  })

  it('calls setLibrary with enabled:false when the sync switch is turned off', async () => {
    const wrapper = mount(ReadingServiceLibraries, { props: { provider: 'hardcover', summary: makeSummary() } })

    const switches = wrapper.findAll('[role="switch"]')
    await switches[1]!.trigger('click')

    expect(mocks.setLibrary).toHaveBeenCalledWith('hardcover', 2, { enabled: false })
  })

  it('shows "customised" when a library has a feature overridden off', () => {
    const wrapper = mount(ReadingServiceLibraries, {
      props: {
        provider: 'hardcover',
        summary: makeSummary({ libraries: [{ libraryId: 2, enabled: true, features: { rating: false } }] }),
      },
    })

    expect(wrapper.text()).toContain('Some features are turned off just for this library.')
  })

  it('exposes a per-feature toggle once Customise is clicked, narrowing without widening', async () => {
    const wrapper = mount(ReadingServiceLibraries, {
      props: {
        provider: 'hardcover',
        summary: makeSummary({ libraries: [{ libraryId: 2, enabled: true, features: {} }] }),
      },
    })

    const customiseButtons = wrapper.findAll('button').filter((b: { text: () => string }) => b.text() === 'Customise')
    expect(customiseButtons).toHaveLength(2)
    await customiseButtons[1]!.trigger('click')
    const featureSwitches = wrapper.findAll('[role="switch"]')
    // Index 0 is Books' sync switch, 1 is Comics' sync switch, the rest are per-feature rows for Comics.
    expect(featureSwitches.length).toBeGreaterThan(2)

    await featureSwitches[2]!.trigger('click')
    expect(mocks.setLibrary).toHaveBeenCalledWith('hardcover', 2, { features: { status: false } })
  })

  it('calls resetLibrary when Reset is clicked on an overridden library', async () => {
    const wrapper = mount(ReadingServiceLibraries, {
      props: {
        provider: 'hardcover',
        summary: makeSummary({ libraries: [{ libraryId: 2, enabled: false, features: {} }] }),
      },
    })

    const resetButtons = wrapper.findAll('button').filter((b: { text: () => string }) => b.text() === 'Reset')
    expect(resetButtons).toHaveLength(1)
    await resetButtons[0]!.trigger('click')

    expect(mocks.resetLibrary).toHaveBeenCalledWith('hardcover', 2)
  })

  it('keeps its frame and shows an honest empty state when there are no libraries yet', () => {
    libraries.value = []
    const wrapper = mount(ReadingServiceLibraries, { props: { provider: 'hardcover', summary: makeSummary() } })

    expect(wrapper.find('.border.border-border').exists()).toBe(true)
    expect(wrapper.text()).toContain('No libraries yet')
    libraries.value = [makeLibrary({ id: 1, name: 'Books' }), makeLibrary({ id: 2, name: 'Comics' })]
  })
})
