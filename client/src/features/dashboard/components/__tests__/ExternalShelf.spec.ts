import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReadingServiceShelfItem } from '@bookorbit/types'
import ExternalShelf from '../ExternalShelf.vue'

const apiMock = vi.fn()
const pushMock = vi.fn()

vi.mock('@/lib/api', () => ({ api: (url: string) => apiMock(url) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock }) }))

function shelfItem(overrides: Partial<ReadingServiceShelfItem> = {}): ReadingServiceShelfItem {
  return {
    provider: 'readwise',
    externalId: 'r1',
    title: 'Piranesi',
    authors: ['Susanna Clarke'],
    coverUrl: null,
    externalUrl: 'https://readwise.io/books/r1',
    bookId: null,
    friend: null,
    ...overrides,
  }
}

async function mountShelf(items: ReadingServiceShelfItem[]) {
  apiMock.mockResolvedValue({ ok: true, json: async () => items })
  const wrapper = mount(ExternalShelf, {
    props: { provider: 'readwise', shelf: 'owned-elsewhere', titleKey: 'dashboard.ownedElsewhere.title', descriptionKey: 'dashboard.ownedElsewhere.description' },
  })
  await flushPromises()
  return wrapper
}

describe('ExternalShelf', () => {
  beforeEach(() => {
    apiMock.mockReset()
    pushMock.mockReset()
  })

  it('fetches the given provider/shelf pair', async () => {
    await mountShelf([])

    expect(apiMock).toHaveBeenCalledWith('/api/v1/reading-services/readwise/shelves/owned-elsewhere')
  })

  it('renders nothing when there are no items', async () => {
    const wrapper = await mountShelf([])

    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('renders a card per item, with a cover-missing fallback tile for items with no cover', async () => {
    const wrapper = await mountShelf([shelfItem(), shelfItem({ externalId: 'r2', title: 'The Employees', authors: ['Olga Ravn'] })])

    const cards = wrapper.findAll('button[type="button"]')
    expect(cards).toHaveLength(2)
    expect(wrapper.text()).toContain('Piranesi')
    expect(wrapper.text()).toContain('The Employees')
  })

  it('opens the matching BookOrbit book when bookId is set', async () => {
    const wrapper = await mountShelf([shelfItem({ bookId: 42 })])

    await wrapper.find('button[type="button"]').trigger('click')

    expect(pushMock).toHaveBeenCalledWith({ name: 'book-detail', params: { bookId: 42 } })
  })

  it('opens the external page in a new tab when there is no library match', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const wrapper = await mountShelf([shelfItem({ bookId: null })])

    await wrapper.find('button[type="button"]').trigger('click')

    expect(openSpy).toHaveBeenCalledWith('https://readwise.io/books/r1', '_blank', 'noopener')
    openSpy.mockRestore()
  })

  it("shows a friend's name and status on a friends-shelf item", async () => {
    const wrapper = await mountShelf([
      shelfItem({ friend: { displayName: 'Alex', avatarUrl: null, status: 'currently reading', date: null } }),
    ])

    expect(wrapper.text()).toContain('Alex')
    expect(wrapper.text()).toContain('currently reading')
  })
})
