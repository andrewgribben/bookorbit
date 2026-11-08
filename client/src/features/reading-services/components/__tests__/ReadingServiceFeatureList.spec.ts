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
  it('renders a toggle for every capability the provider declares, and nothing else', () => {
    const wrapper = mount(ReadingServiceFeatureList, {
      props: { provider: 'readwise', summary: makeSummary() },
    })

    const switches = wrapper.findAll('[role="switch"]')
    expect(switches.length).toBe(4)

    const statusSwitch = wrapper.get('#reading-service-readwise-status')
    expect(statusSwitch.attributes('disabled')).toBeUndefined()
  })

  it('does not render a row at all for a feature the platform does not have', () => {
    const wrapper = mount(ReadingServiceFeatureList, {
      props: { provider: 'readwise', summary: makeSummary() },
    })

    expect(wrapper.find('#reading-service-readwise-bookmarks').exists()).toBe(false)
    expect(wrapper.find('#reading-service-readwise-review').exists()).toBe(false)
    expect(wrapper.find('#reading-service-readwise-highlights').exists()).toBe(false)
  })

  it('renders a row for a feature once the provider declares that capability', () => {
    const wrapper = mount(ReadingServiceFeatureList, {
      props: { provider: 'readwise', summary: makeSummary({ capabilities: { status: 'both', bookmarks: 'push' } }) },
    })

    expect(wrapper.find('#reading-service-readwise-bookmarks').exists()).toBe(true)
    expect(wrapper.find('#reading-service-readwise-status').exists()).toBe(true)
  })

  it('greys and disables publish_sessions while sessions is off, with a dependency hint', () => {
    const wrapper = mount(ReadingServiceFeatureList, {
      props: {
        provider: 'readwise',
        summary: makeSummary({ capabilities: { sessions: 'both', publish_sessions: 'push' }, features: { sessions: false } }),
      },
    })

    const toggle = wrapper.get('#reading-service-readwise-publish_sessions')
    expect(toggle.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Needs session sync turned on first.')
  })

  it('enables publish_sessions once sessions is on', () => {
    const wrapper = mount(ReadingServiceFeatureList, {
      props: {
        provider: 'readwise',
        summary: makeSummary({ capabilities: { sessions: 'both', publish_sessions: 'push' }, features: { sessions: true } }),
      },
    })

    const toggle = wrapper.get('#reading-service-readwise-publish_sessions')
    expect(toggle.attributes('disabled')).toBeUndefined()
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
