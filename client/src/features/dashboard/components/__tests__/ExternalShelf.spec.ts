import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReadingServiceShelfItem } from '@bookorbit/types'
import ExternalShelf from '../ExternalShelf.vue'

const apiMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>()
const pushMock = vi.fn<(...args: unknown[]) => unknown>()
const hasPermissionMock = vi.fn<(...args: unknown[]) => unknown>().mockReturnValue(false)

vi.mock('@/lib/api', () => ({ api: (url: string, init?: RequestInit) => apiMock(url, init) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: pushMock }) }))
vi.mock('@/features/auth/composables/usePermissions', () => ({ usePermissions: () => ({ hasPermission: hasPermissionMock }) }))
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: { name: 'DropdownMenu', template: '<div><slot /></div>' },
  DropdownMenuContent: { name: 'DropdownMenuContent', template: '<div><slot /></div>' },
  DropdownMenuItem: {
    name: 'DropdownMenuItem',
    props: ['disabled'],
    emits: ['click'],
    template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  DropdownMenuTrigger: { name: 'DropdownMenuTrigger', template: '<button type="button"><slot /></button>' },
}))

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

function jsonResponse(data: unknown, ok = true): Response {
  return { ok, json: async () => data } as Response
}

async function mountShelf(items: ReadingServiceShelfItem[], shelf = 'owned-elsewhere') {
  apiMock.mockImplementation((url: string) => {
    if (url.startsWith('/api/v1/reading-services/')) return Promise.resolve(jsonResponse(items))
    return Promise.resolve(jsonResponse([]))
  })
  const wrapper = mount(ExternalShelf, {
    props: {
      provider: 'readwise',
      shelf,
      titleKey: 'dashboard.ownedElsewhere.title',
      descriptionKey: 'dashboard.ownedElsewhere.description',
    } as never,
  })
  await flushPromises()
  return wrapper
}

describe('ExternalShelf', () => {
  beforeEach(() => {
    apiMock.mockReset()
    pushMock.mockReset()
    hasPermissionMock.mockReset().mockReturnValue(false)
  })

  it('fetches the given provider/shelf pair', async () => {
    await mountShelf([])

    expect(apiMock).toHaveBeenCalledWith('/api/v1/reading-services/readwise/shelves/owned-elsewhere', undefined)
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
    const wrapper = await mountShelf([shelfItem({ friend: { displayName: 'Alex', avatarUrl: null, status: 'currently reading', date: null } })])

    expect(wrapper.text()).toContain('Alex')
    expect(wrapper.text()).toContain('currently reading')
  })

  describe('the Request action', () => {
    it('is hidden on an owned-elsewhere card without the book-request permission', async () => {
      hasPermissionMock.mockReturnValue(false)
      const wrapper = await mountShelf([shelfItem({ bookId: null })])

      expect(wrapper.findComponent({ name: 'DropdownMenu' }).exists()).toBe(false)
      expect(apiMock).not.toHaveBeenCalledWith('/api/v1/book-requests/availability', expect.anything())
    })

    it('is hidden on every shelf other than owned-elsewhere even with the permission', async () => {
      hasPermissionMock.mockReturnValue(true)
      const wrapper = await mountShelf([shelfItem({ bookId: null })], 'trending')

      expect(wrapper.findComponent({ name: 'DropdownMenu' }).exists()).toBe(false)
    })

    it('is hidden for a card already matched to a BookOrbit book', async () => {
      hasPermissionMock.mockReturnValue(true)
      const wrapper = await mountShelf([shelfItem({ bookId: 7 })])

      expect(wrapper.findComponent({ name: 'DropdownMenu' }).exists()).toBe(false)
    })

    it('shows the menu with a Request item on an unmatched card with the permission, and submits on click', async () => {
      hasPermissionMock.mockReturnValue(true)
      apiMock.mockImplementation((url: string) => {
        if (url.startsWith('/api/v1/reading-services/')) return Promise.resolve(jsonResponse([shelfItem({ bookId: null })]))
        if (url === '/api/v1/book-requests/availability') {
          return Promise.resolve(
            jsonResponse([{ ownedBookId: null, existingRequestId: null, existingRequestStatus: null, alreadySubscribed: false }]),
          )
        }
        if (url === '/api/v1/book-requests') return Promise.resolve(jsonResponse({ request: { id: 5, status: 'pending' }, subscribed: false }))
        return Promise.resolve(jsonResponse([]))
      })

      const wrapper = mount(ExternalShelf, {
        props: {
          provider: 'readwise',
          shelf: 'owned-elsewhere',
          titleKey: 'dashboard.ownedElsewhere.title',
          descriptionKey: 'dashboard.ownedElsewhere.description',
        },
      })
      await flushPromises()

      expect(wrapper.findComponent({ name: 'DropdownMenu' }).exists()).toBe(true)

      await wrapper.find('button[aria-label]').trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('Request')

      const requestItem = wrapper.findAllComponents({ name: 'DropdownMenuItem' })[0]
      await requestItem.trigger('click')
      await flushPromises()
      expect(apiMock).toHaveBeenCalledWith('/api/v1/book-requests', expect.objectContaining({ method: 'POST' }))
    })
  })
})
