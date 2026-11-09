import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>())

vi.mock('@/lib/api', () => ({
  api: apiMock,
}))

function makeResponse(data?: unknown, ok = true): Response {
  return {
    ok,
    json: async () => data,
  } as Response
}

async function loadComposable() {
  const module = await import('../useExternalBookRequests')
  return module
}

describe('useExternalBookRequests', () => {
  beforeEach(() => {
    vi.resetModules()
    apiMock.mockReset()
  })

  it('marks a candidate requestable when availability finds nothing', async () => {
    apiMock.mockResolvedValue(makeResponse([{ ownedBookId: null, existingRequestId: null, existingRequestStatus: null, alreadySubscribed: false }]))
    const { useExternalBookRequests } = await loadComposable()
    const { stateFor, checkMany } = useExternalBookRequests()

    await checkMany([{ externalId: 'rw-1', title: 'Dune', author: 'Frank Herbert' }])

    expect(stateFor('rw-1')).toBe('requestable')
    expect(apiMock).toHaveBeenCalledWith('/api/v1/book-requests/availability', expect.objectContaining({ method: 'POST' }))
  })

  it('marks a candidate already-requested when availability finds an active request', async () => {
    apiMock.mockResolvedValue(
      makeResponse([{ ownedBookId: null, existingRequestId: 42, existingRequestStatus: 'pending', alreadySubscribed: false }]),
    )
    const { useExternalBookRequests } = await loadComposable()
    const { stateFor, requestIdFor, checkMany } = useExternalBookRequests()

    await checkMany([{ externalId: 'rw-2', title: 'Dune' }])

    expect(stateFor('rw-2')).toBe('already-requested')
    expect(requestIdFor('rw-2')).toBe(42)
  })

  it('marks a candidate owned when availability finds a library copy', async () => {
    apiMock.mockResolvedValue(makeResponse([{ ownedBookId: 7, existingRequestId: null, existingRequestStatus: null, alreadySubscribed: false }]))
    const { useExternalBookRequests } = await loadComposable()
    const { stateFor, checkMany } = useExternalBookRequests()

    await checkMany([{ externalId: 'rw-3', title: 'Dune' }])

    expect(stateFor('rw-3')).toBe('owned')
  })

  it('exposes the owned book id so a caller can navigate straight to it', async () => {
    apiMock.mockResolvedValue(makeResponse([{ ownedBookId: 7, existingRequestId: null, existingRequestStatus: null, alreadySubscribed: false }]))
    const { useExternalBookRequests } = await loadComposable()
    const { ownedBookIdFor, checkMany } = useExternalBookRequests()

    await checkMany([{ externalId: 'rw-3', title: 'Dune' }])

    expect(ownedBookIdFor('rw-3')).toBe(7)
  })

  it('leaves the owned book id unset for a candidate with no library match', async () => {
    apiMock.mockResolvedValue(makeResponse([{ ownedBookId: null, existingRequestId: null, existingRequestStatus: null, alreadySubscribed: false }]))
    const { useExternalBookRequests } = await loadComposable()
    const { ownedBookIdFor, checkMany } = useExternalBookRequests()

    await checkMany([{ externalId: 'rw-1', title: 'Dune' }])

    expect(ownedBookIdFor('rw-1')).toBeNull()
  })

  it('requestOne posts to the ordinary single-request endpoint and settles to requested', async () => {
    apiMock.mockResolvedValue(makeResponse({ request: { id: 99, status: 'pending' }, subscribed: false }))
    const { useExternalBookRequests } = await loadComposable()
    const { stateFor, requestIdFor, requestOne } = useExternalBookRequests()

    await requestOne({ externalId: 'rw-4', title: 'Dune', author: 'Frank Herbert', coverUrl: 'https://example.com/cover.jpg' })

    expect(stateFor('rw-4')).toBe('requested')
    expect(requestIdFor('rw-4')).toBe(99)
    expect(apiMock).toHaveBeenCalledWith(
      '/api/v1/book-requests',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'Dune', mediaKind: 'ebook', authors: ['Frank Herbert'], coverUrl: 'https://example.com/cover.jpg' }),
      }),
    )
  })

  it('requestOne settles to error with the server message on refusal', async () => {
    apiMock.mockResolvedValue(makeResponse({ message: 'Title is required' }, false))
    const { useExternalBookRequests } = await loadComposable()
    const { stateFor, errorFor, requestOne } = useExternalBookRequests()

    await requestOne({ externalId: 'rw-5', title: 'Dune' })

    expect(stateFor('rw-5')).toBe('error')
    expect(errorFor('rw-5')).toBe('Title is required')
  })

  it('requestAll posts the bulk endpoint once and applies per-item results', async () => {
    apiMock.mockResolvedValue(
      makeResponse({
        created: 1,
        skipped: 1,
        errors: 0,
        results: [
          { externalId: 'rw-6', status: 'created', requestId: 1 },
          { externalId: 'rw-7', status: 'skipped', requestId: 2 },
        ],
      }),
    )
    const { useExternalBookRequests } = await loadComposable()
    const { stateFor, requestAll } = useExternalBookRequests()

    const result = await requestAll([
      { externalId: 'rw-6', title: 'Dune' },
      { externalId: 'rw-7', title: 'Dune Messiah' },
    ])

    expect(result).toEqual({
      created: 1,
      skipped: 1,
      errors: 0,
      results: [
        { externalId: 'rw-6', status: 'created', requestId: 1 },
        { externalId: 'rw-7', status: 'skipped', requestId: 2 },
      ],
    })
    expect(stateFor('rw-6')).toBe('requested')
    expect(stateFor('rw-7')).toBe('already-requested')
    expect(apiMock).toHaveBeenCalledTimes(1)
    expect(apiMock).toHaveBeenCalledWith('/api/v1/book-requests/bulk-submit', expect.objectContaining({ method: 'POST' }))
  })

  it('requestAll batches beyond BOOK_REQUEST_BULK_LIMIT into more than one call', async () => {
    apiMock.mockResolvedValue(makeResponse({ created: 0, skipped: 0, errors: 0, results: [] }))
    const { useExternalBookRequests } = await loadComposable()
    const { requestAll } = useExternalBookRequests()

    const candidates = Array.from({ length: 101 }, (_, i) => ({ externalId: `rw-${i}`, title: `Book ${i}` }))
    await requestAll(candidates)

    expect(apiMock).toHaveBeenCalledTimes(2)
  })
})
