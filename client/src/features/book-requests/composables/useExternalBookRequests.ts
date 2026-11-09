import { reactive } from 'vue'
import { api } from '@/lib/api'
import { BOOK_REQUEST_BULK_LIMIT } from '@bookorbit/types'
import type { BookRequestAvailability, BulkSubmitBookRequestItem, BulkSubmitBookRequestsResult } from '@bookorbit/types'

/**
 * What one row's Request control shows. `idle` is before anything has been checked; `checking` and
 * `requesting` are in flight; the rest are settled answers.
 */
export type ExternalBookRequestState = 'idle' | 'checking' | 'requestable' | 'already-requested' | 'owned' | 'requesting' | 'requested' | 'error'

export interface ExternalBookRequestCandidate {
  externalId: string
  title: string | null
  author?: string | null
  coverUrl?: string | null
}

const CHECK_BATCH_LIMIT = 50

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}))
  const message = (body as { message?: string | string[] }).message
  return (Array.isArray(message) ? message[0] : message) ?? fallback
}

/**
 * Requesting a book from a list this module did not build - the Readwise-only migration list, the
 * "owned elsewhere" dashboard shelf - by reusing the book-requests module's own endpoints rather
 * than touching its tables: `POST /book-requests/availability` to show whether a row is already
 * owned or already requested before anyone clicks anything, `POST /book-requests` for a single row
 * (the same endpoint the request form itself calls), and `POST /book-requests/bulk-submit` for
 * "Request all", which still runs every item through `BookRequestService.submit()` on the server.
 *
 * One instance covers one list: state is keyed by the caller's own `externalId`, so a Readwise
 * book and a shelf card never collide even if a title happens to match.
 */
export function useExternalBookRequests() {
  const states = reactive(new Map<string, ExternalBookRequestState>())
  const errorMessages = reactive(new Map<string, string>())
  const requestIds = reactive(new Map<string, number>())
  const ownedBookIds = reactive(new Map<string, number>())

  function stateFor(externalId: string): ExternalBookRequestState {
    return states.get(externalId) ?? 'idle'
  }

  function ownedBookIdFor(externalId: string): number | null {
    return ownedBookIds.get(externalId) ?? null
  }

  function errorFor(externalId: string): string | null {
    return errorMessages.get(externalId) ?? null
  }

  function requestIdFor(externalId: string): number | null {
    return requestIds.get(externalId) ?? null
  }

  /** Annotates a page of candidates as owned / already requested / requestable, before display. */
  async function checkMany(candidates: ExternalBookRequestCandidate[]): Promise<void> {
    const toCheck = candidates.filter((candidate) => candidate.title && stateFor(candidate.externalId) === 'idle')
    for (let i = 0; i < toCheck.length; i += CHECK_BATCH_LIMIT) {
      const batch = toCheck.slice(i, i + CHECK_BATCH_LIMIT)
      batch.forEach((candidate) => states.set(candidate.externalId, 'checking'))
      try {
        const res = await api('/api/v1/book-requests/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: batch.map((candidate) => ({
              title: candidate.title,
              mediaKind: 'ebook',
              ...(candidate.author ? { author: candidate.author } : {}),
            })),
          }),
        })
        const availability: BookRequestAvailability[] = res.ok ? await res.json() : []
        batch.forEach((candidate, index) => {
          const result = availability[index]
          if (result?.ownedBookId) {
            states.set(candidate.externalId, 'owned')
            ownedBookIds.set(candidate.externalId, result.ownedBookId)
          } else if (result?.existingRequestId) {
            states.set(candidate.externalId, 'already-requested')
            requestIds.set(candidate.externalId, result.existingRequestId)
          } else {
            states.set(candidate.externalId, 'requestable')
          }
        })
      } catch {
        // The row still offers the request; the check only decorates it.
        batch.forEach((candidate) => states.set(candidate.externalId, 'requestable'))
      }
    }
  }

  /** One row's Request button, going straight through the ordinary single-request endpoint. */
  async function requestOne(candidate: ExternalBookRequestCandidate): Promise<void> {
    if (!candidate.title) return
    states.set(candidate.externalId, 'requesting')
    errorMessages.delete(candidate.externalId)
    try {
      const res = await api('/api/v1/book-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: candidate.title,
          mediaKind: 'ebook',
          ...(candidate.author ? { authors: [candidate.author] } : {}),
          ...(candidate.coverUrl ? { coverUrl: candidate.coverUrl } : {}),
        }),
      })
      if (!res.ok) {
        states.set(candidate.externalId, 'error')
        errorMessages.set(candidate.externalId, await errorMessage(res, 'Failed to request this book'))
        return
      }
      const result = (await res.json()) as { request: { id: number } }
      requestIds.set(candidate.externalId, result.request.id)
      states.set(candidate.externalId, 'requested')
    } catch {
      states.set(candidate.externalId, 'error')
      errorMessages.set(candidate.externalId, 'Failed to request this book')
    }
  }

  /**
   * "Request all": batched at `BOOK_REQUEST_BULK_LIMIT` per call (the server enforces the same
   * cap), so a list longer than that still goes out as a small, bounded number of requests rather
   * than one oversized payload or one HTTP call per row.
   */
  async function requestAll(candidates: ExternalBookRequestCandidate[]): Promise<BulkSubmitBookRequestsResult> {
    const items: BulkSubmitBookRequestItem[] = candidates
      .filter((candidate) => candidate.title)
      .map((candidate) => ({
        externalId: candidate.externalId,
        title: candidate.title as string,
        ...(candidate.author ? { authors: [candidate.author] } : {}),
        ...(candidate.coverUrl ? { coverUrl: candidate.coverUrl } : {}),
      }))

    const total: BulkSubmitBookRequestsResult = { created: 0, skipped: 0, errors: 0, results: [] }
    for (let i = 0; i < items.length; i += BOOK_REQUEST_BULK_LIMIT) {
      const batch = items.slice(i, i + BOOK_REQUEST_BULK_LIMIT)
      batch.forEach((item) => states.set(item.externalId, 'requesting'))
      try {
        const res = await api('/api/v1/book-requests/bulk-submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: batch }),
        })
        if (!res.ok) {
          batch.forEach((item) => states.set(item.externalId, 'error'))
          total.errors += batch.length
          continue
        }
        const result = (await res.json()) as BulkSubmitBookRequestsResult
        total.created += result.created
        total.skipped += result.skipped
        total.errors += result.errors
        total.results.push(...result.results)
        result.results.forEach((row) => {
          if (row.status === 'created') states.set(row.externalId, 'requested')
          else if (row.status === 'skipped') states.set(row.externalId, 'already-requested')
          else {
            states.set(row.externalId, 'error')
            if (row.message) errorMessages.set(row.externalId, row.message)
          }
          if (row.requestId) requestIds.set(row.externalId, row.requestId)
        })
      } catch {
        batch.forEach((item) => states.set(item.externalId, 'error'))
        total.errors += batch.length
      }
    }
    return total
  }

  return { stateFor, errorFor, requestIdFor, ownedBookIdFor, checkMany, requestOne, requestAll }
}
