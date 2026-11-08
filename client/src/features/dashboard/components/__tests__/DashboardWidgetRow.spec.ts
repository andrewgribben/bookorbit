import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref, type Ref } from 'vue'
import type { WidgetConfig } from '@bookorbit/types'
import DashboardWidgetRow from '../DashboardWidgetRow.vue'

const widgets = ref<WidgetConfig[]>([{ id: '1', type: 'reading-recap', enabled: true, order: 1 }])
const recapData = ref<unknown>(null)
const recapLoading = ref(false)

vi.mock('../../composables/useDashboardWidgets', () => ({
  useDashboardWidgets: () => ({
    widgets,
    enabledWidgets: widgets,
    saveWidgets: vi.fn(),
  }),
}))

vi.mock('../../composables/useReadingRecapWidget', () => ({
  useReadingRecapWidget: () => ({ data: recapData, loading: recapLoading, error: ref(false), refresh: vi.fn() }),
}))

function setRecap(data: unknown, loading: boolean) {
  recapData.value = data
  recapLoading.value = loading
}

describe('DashboardWidgetRow', () => {
  it('does not render the card shell while the reading-recap widget is the only one enabled and its data is null', async () => {
    setRecap(null, false)
    const wrapper = mount(DashboardWidgetRow, { global: { stubs: { ReadingRecapWidget: true } } })
    await flushPromises()

    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('renders the card shell while the reading-recap widget is still loading', async () => {
    setRecap(null, true)
    const wrapper = mount(DashboardWidgetRow, { global: { stubs: { ReadingRecapWidget: true } } })
    await flushPromises()

    expect(wrapper.find('section').exists()).toBe(true)
  })

  it('renders the card shell once the reading-recap widget has data', async () => {
    setRecap({ provider: 'readwise', year: 2026, booksFinished: 1, sessions: 1, totalSeconds: 1, readingDays: 1, goal: null, byMonth: [] }, false)
    const wrapper = mount(DashboardWidgetRow, { global: { stubs: { ReadingRecapWidget: true } } })
    await flushPromises()

    expect(wrapper.find('section').exists()).toBe(true)
  })
})
