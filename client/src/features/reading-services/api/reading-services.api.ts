import { api } from '@/lib/api'
import type {
  ReadingServiceFeature,
  ReadingServiceProvider,
  ReadingServiceRemoteOnlyBooksPage,
  ReadingServiceSummary,
  SyncRunProgress,
} from '@bookorbit/types'

const BASE = '/api/v1/reading-services'

export type MigrationPreview = { matched: number; toCreate: number; readwiseOnly: number }

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}))
  return (body as { message?: string }).message ?? fallback
}

export async function fetchReadingServiceSummaries(): Promise<ReadingServiceSummary[]> {
  const res = await api(BASE)
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to fetch reading services'))
  return res.json()
}

export async function updateReadingServiceFeatures(
  provider: ReadingServiceProvider,
  features: Partial<Record<ReadingServiceFeature, boolean>>,
): Promise<Partial<Record<ReadingServiceFeature, boolean>>> {
  const res = await api(`${BASE}/${provider}/features`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ features }),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to update sync settings'))
  return res.json()
}

export type ReadingServiceLibraryUpdate = { enabled?: boolean; features?: Partial<Record<string, boolean>>; seriesMode?: boolean }

export async function updateReadingServiceLibrary(
  provider: ReadingServiceProvider,
  libraryId: number,
  update: ReadingServiceLibraryUpdate,
): Promise<{ libraryId: number; enabled: boolean; features: Partial<Record<string, boolean>>; seriesMode: boolean }> {
  const res = await api(`${BASE}/${provider}/libraries/${libraryId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to update synced library'))
  return res.json()
}

export async function resetReadingServiceLibrary(
  provider: ReadingServiceProvider,
  libraryId: number,
): Promise<{ libraryId: number; enabled: boolean; features: Partial<Record<string, boolean>>; seriesMode: boolean }> {
  const res = await api(`${BASE}/${provider}/libraries/${libraryId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to reset library sync settings'))
  return res.json()
}

export async function previewReadingServiceMigration(provider: ReadingServiceProvider): Promise<MigrationPreview> {
  const res = await api(`${BASE}/${provider}/migration/preview`, { method: 'POST' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to preview migration'))
  return res.json()
}

export async function startReadingServiceMigration(provider: ReadingServiceProvider): Promise<SyncRunProgress> {
  const res = await api(`${BASE}/${provider}/migration`, { method: 'POST' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to start migration'))
  return res.json()
}

export async function fetchReadingServiceRun(id: number): Promise<SyncRunProgress> {
  const res = await api(`${BASE}/runs/${id}`)
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to fetch migration run'))
  return res.json()
}

export async function cancelReadingServiceRun(id: number): Promise<SyncRunProgress> {
  const res = await api(`${BASE}/runs/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to cancel migration'))
  return res.json()
}

export async function resumeReadingServiceMigration(id: number): Promise<SyncRunProgress> {
  const res = await api(`${BASE}/runs/${id}/resume`, { method: 'POST' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to resume migration'))
  return res.json()
}

export async function fetchReadwiseOnlyBooks(
  provider: ReadingServiceProvider,
  offset: number,
  limit: number,
): Promise<ReadingServiceRemoteOnlyBooksPage> {
  const res = await api(`${BASE}/${provider}/migration/readwise-only?offset=${offset}&limit=${limit}`)
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to fetch provider-only books'))
  return res.json()
}
