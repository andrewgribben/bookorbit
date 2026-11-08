import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import type { ReadingServiceSummary } from '@bookorbit/types'
import ReadingServiceFeatureList from '../ReadingServiceFeatureList.vue'

const mocks = vi.hoisted(() => ({
  setFeature: vi.fn<(provider: string, feature: string, enabled: boolean) => Promise<boolean>>().mockResolvedValue(true),
}))

const savingFeature = ref<string | null>(null)

vi.mock('../../composables/useReadingServices', () => ({
  useReadingServices: () => ({
    savingFeature,
    setFeature: mocks.setFeature,
  }),
}))

function makeSummary(overrides: Partial<ReadingServiceSummary> = {}): ReadingServiceSummary {
  return {
    provider: 'readwise',
    connected: true,
    capabilities: { status: 'both', rating: 'both', dates: 'both', owned: 'read' },
    features: {},
    migration: { state: 'never', runId: null, finishedAt: null },
    lastPullAt: null,
    disabledReason: null,
    libraries: [],
    ...overrides,
  }
}

describe('ReadingServiceFeatureList', () => {
  it('renders a toggle for every capability the provider declares', () => {
    const wrapper = mount(ReadingServiceFeatureList, {
      props: { provider: 'readwise', summary: makeSummary() },
    })

    const switches = wrapper.findAll('[role="switch"]')
    expect(switches.length).toBeGreaterThanOrEqual(12)

    const statusSwitch = wrapper.get('#reading-service-readwise-status')
    expect(statusSwitch.attributes('disabled')).toBeUndefined()
  })

  it('disables the bookmarks row with a reason, since no provider declares that capability', () => {
    const wrapper = mount(ReadingServiceFeatureList, {
      props: { provider: 'readwise', summary: makeSummary() },
    })

    const bookmarksSwitch = wrapper.get('#reading-service-readwise-bookmarks')
    expect(bookmarksSwitch.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Readwise has no bookmarks API.')
  })

  it('disables rows for features the provider has no capability for, with a reason shown', () => {
    const wrapper = mount(ReadingServiceFeatureList, {
      props: { provider: 'readwise', summary: makeSummary() },
    })

    const reviewSwitch = wrapper.get('#reading-service-readwise-review')
    expect(reviewSwitch.attributes('disabled')).toBeDefined()
    expect(reviewSwitch.attributes('aria-checked')).toBe('false')
    expect(wrapper.text()).toContain("Reviews aren't synced yet.")
  })

  it('reads a missing feature flag as on, since capabilities are opt-out', () => {
    const wrapper = mount(ReadingServiceFeatureList, {
      props: { provider: 'readwise', summary: makeSummary({ features: {} }) },
    })

    expect(wrapper.get('#reading-service-readwise-status').attributes('aria-checked')).toBe('true')
  })

  it('reads an explicit false feature flag as off', () => {
    const wrapper = mount(ReadingServiceFeatureList, {
      props: { provider: 'readwise', summary: makeSummary({ features: { status: false } }) },
    })

    expect(wrapper.get('#reading-service-readwise-status').attributes('aria-checked')).toBe('false')
  })

  it('calls setFeature with the provider and feature when a supported toggle is clicked', async () => {
    const wrapper = mount(ReadingServiceFeatureList, {
      props: { provider: 'readwise', summary: makeSummary() },
    })

    await wrapper.get('#reading-service-readwise-status').trigger('click')

    expect(mocks.setFeature).toHaveBeenCalledWith('readwise', 'status', false)
  })
})
