import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ExternalBookCard } from '@bookorbit/types'
import OwnedElsewhereShelf from '../OwnedElsewhereShelf.vue'

const apiMock = vi.fn()
const pushMock = vi.fn()

vi.mock('@/lib/api', () => ({ api: (url: string) => apiMock(url) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock }) }))

function card(overrides: Partial<ExternalBookCard> = {}): ExternalBookCard {
  return {
    title: 'Piranesi',
    author: 'Susanna Clarke',
    coverUrl: null,
    isbn13: '9780306406157',
    provider: 'readwise',
    providerUrl: 'https://readwise.io/books/r1',
    libraryBookId: null,
    people: [],
    ...overrides,
  }
}

async function mountShelf(books: ExternalBookCard[]) {
  apiMock.mockResolvedValue({ ok: true, json: async () => ({ books, total: books.length }) })
  const wrapper = mount(OwnedElsewhereShelf)
  await flushPromises()
  return wrapper
}

describe('OwnedElsewhereShelf', () => {
  beforeEach(() => {
    apiMock.mockReset()
    pushMock.mockReset()
  })

  it('renders nothing when there are no owned-elsewhere books', async () => {
    const wrapper = await mountShelf([])

    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('renders a card per book, with a cover-missing fallback tile for books with no cover', async () => {
    const wrapper = await mountShelf([card(), card({ title: 'The Employees', author: 'Olga Ravn', isbn13: null })])

    const cards = wrapper.findAll('button[type="button"]')
    expect(cards).toHaveLength(2)
    expect(wrapper.text()).toContain('Piranesi')
    expect(wrapper.text()).toContain('The Employees')
  })

  it('opens the matching BookOrbit book when libraryBookId is set', async () => {
    const wrapper = await mountShelf([card({ libraryBookId: 42 })])

    await wrapper.find('button[type="button"]').trigger('click')

    expect(pushMock).toHaveBeenCalledWith({ name: 'book-detail', params: { bookId: 42 } })
  })

  it('opens the Readwise page in a new tab when there is no library match', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const wrapper = await mountShelf([card({ libraryBookId: null })])

    await wrapper.find('button[type="button"]').trigger('click')

    expect(openSpy).toHaveBeenCalledWith('https://readwise.io/books/r1', '_blank', 'noopener')
    openSpy.mockRestore()
  })
})
