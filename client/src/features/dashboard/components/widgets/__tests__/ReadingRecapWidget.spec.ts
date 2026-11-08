import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReadingRecapWidget as ReadingRecapWidgetData } from '@bookorbit/types'
import ReadingRecapWidgetComponent from '../ReadingRecapWidget.vue'
import { resetReadingRecapWidgetForTests } from '../../../composables/useReadingRecapWidget'

const fetchReadingRecap = vi.fn<() => Promise<ReadingRecapWidgetData | null>>()

vi.mock('@/features/dashboard/api/dashboard-widget.api', () => ({
  fetchReadingRecap: () => fetchReadingRecap(),
}))

function recap(overrides: Partial<ReadingRecapWidgetData> = {}): ReadingRecapWidgetData {
  return {
    provider: 'readwise',
    year: 2026,
    booksFinished: 12,
    sessions: 40,
    totalSeconds: 3600 * 20,
    readingDays: 15,
    goal: 50,
    byMonth: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, seconds: i === 10 ? 3600 : 0 })),
    ...overrides,
  }
}

async function mountWidget(data: ReadingRecapWidgetData | null) {
  fetchReadingRecap.mockResolvedValue(data)
  const wrapper = mount(ReadingRecapWidgetComponent)
  await flushPromises()
  return wrapper
}

describe('ReadingRecapWidget', () => {
  beforeEach(() => {
    resetReadingRecapWidgetForTests()
    fetchReadingRecap.mockReset()
  })

  it('renders nothing when the widget endpoint returns null (disconnected or toggled off)', async () => {
    const wrapper = await mountWidget(null)

    expect(wrapper.find('div').exists()).toBe(false)
  })

  it('shows the KPI strip and a goal bar when a goal is set', async () => {
    const wrapper = await mountWidget(recap())

    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('40')
    expect(wrapper.text()).toContain('15')
    expect(wrapper.text()).toContain('20h')
    expect(wrapper.text()).toContain('50')
  })

  it('shows the no-goal message instead of a goal bar when goal is null', async () => {
    const wrapper = await mountWidget(recap({ goal: null }))

    expect(wrapper.text()).toContain('No reading goal set this year')
  })
})
