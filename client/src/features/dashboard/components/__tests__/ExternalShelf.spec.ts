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
  DropdownMenuTrigger: { name: 'DropdownMenuTrigger', template: '<div><slot /></div>' },
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

    const cards = wrapper.findAll('div.group\\/card')
    expect(cards).toHaveLength(2)
    expect(wrapper.text()).toContain('Piranesi')
    expect(wrapper.text()).toContain('The Employees')
  })

  it('opens the matching BookOrbit book when bookId is set', async () => {
    const wrapper = await mountShelf([shelfItem({ bookId: 42 })])

    await wrapper.find('button[type="button"]').trigger('click')

    expect(pushMock).toHaveBeenCalledWith({ name: 'book-detail', params: { bookId: 42 } })
  })

  it("shows a friend's name and status on a friends-shelf item", async () => {
    const wrapper = await mountShelf([shelfItem({ friend: { displayName: 'Alex', avatarUrl: null, status: 'currently reading', date: null } })])

    expect(wrapper.text()).toContain('Alex')
    expect(wrapper.text()).toContain('currently reading')
  })

  it('does nothing when tapping an unmatched card with no externalUrl and no request permission', async () => {
    hasPermissionMock.mockReturnValue(false)
    const wrapper = await mountShelf([shelfItem({ bookId: null, externalUrl: null })])

    await wrapper.find('button[type="button"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAllComponents({ name: 'DropdownMenuItem' })).toHaveLength(0)
    expect(apiMock).not.toHaveBeenCalledWith('/api/v1/book-requests/availability', expect.anything())
  })

  describe('the unmatched-card menu', () => {
    it('shows only "View in <provider>" without the permission', async () => {
      hasPermissionMock.mockReturnValue(false)
      const wrapper = await mountShelf([shelfItem({ bookId: null })])

      await wrapper.find('button[type="button"]').trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('View in Readwise')
      expect(wrapper.text()).not.toContain('Add to requests')
      expect(apiMock).not.toHaveBeenCalledWith('/api/v1/book-requests/availability', expect.anything())
    })

    it('opens the provider page when "View in <provider>" is clicked', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
      const wrapper = await mountShelf([shelfItem({ bookId: null })])

      await wrapper.find('button[type="button"]').trigger('click')
      await flushPromises()
      await wrapper.findAllComponents({ name: 'DropdownMenuItem' })[0].trigger('click')

      expect(openSpy).toHaveBeenCalledWith('https://readwise.io/books/r1', '_blank', 'noopener')
      openSpy.mockRestore()
    })

    it('shows both actions with the permission, on every shelf, not only owned-elsewhere', async () => {
      hasPermissionMock.mockReturnValue(true)
      const wrapper = await mountShelf(
        [shelfItem({ bookId: null, friend: { displayName: 'Alex', avatarUrl: null, status: 'currently reading', date: null } })],
        'friends-reading',
      )

      await wrapper.find('button[type="button"]').trigger('click')
      await flushPromises()

      const items = wrapper.findAllComponents({ name: 'DropdownMenuItem' })
      expect(items).toHaveLength(2)
      expect(wrapper.text()).toContain('View in Readwise')
      expect(wrapper.text()).toContain('Add to requests')
    })

    it('is hidden for a card already matched to a BookOrbit book', async () => {
      hasPermissionMock.mockReturnValue(true)
      const wrapper = await mountShelf([shelfItem({ bookId: 7 })])

      await wrapper.find('button[type="button"]').trigger('click')
      await flushPromises()

      expect(wrapper.findComponent({ name: 'DropdownMenuContent' }).exists()).toBe(false)
      expect(pushMock).toHaveBeenCalledWith({ name: 'book-detail', params: { bookId: 7 } })
    })

    it('submits the request when "Add to requests" is clicked', async () => {
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

      await wrapper.find('button[type="button"]').trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('Add to requests')

      const requestItem = wrapper.findAllComponents({ name: 'DropdownMenuItem' })[1]
      await requestItem.trigger('click')
      await flushPromises()
      expect(apiMock).toHaveBeenCalledWith('/api/v1/book-requests', expect.objectContaining({ method: 'POST' }))
    })

    it('checks availability for just the tapped card and navigates to the book when already owned', async () => {
      hasPermissionMock.mockReturnValue(true)
      apiMock.mockImplementation((url: string) => {
        if (url.startsWith('/api/v1/reading-services/')) return Promise.resolve(jsonResponse([shelfItem({ bookId: null })]))
        if (url === '/api/v1/book-requests/availability') {
          return Promise.resolve(jsonResponse([{ ownedBookId: 99, existingRequestId: null, existingRequestStatus: null, alreadySubscribed: false }]))
        }
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

      await wrapper.find('button[type="button"]').trigger('click')
      await flushPromises()

      expect(apiMock).toHaveBeenCalledWith(
        '/api/v1/book-requests/availability',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ items: [{ title: 'Piranesi', mediaKind: 'ebook', author: 'Susanna Clarke' }] }),
        }),
      )
      expect(pushMock).toHaveBeenCalledWith({ name: 'book-detail', params: { bookId: 99 } })
    })
  })
})
