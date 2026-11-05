import { api } from '@/lib/api'
import type { MarkSeriesReadResponse, SeriesBooksPage, SeriesFollowStatus, SeriesFollowStatusResponse, SeriesPage } from '@bookorbit/types'
import type { CompletionStatus, SeriesBookSort, SeriesListSort, SortDirection } from '../types/series'

type ListSeriesParams = {
  q?: string
  page: number
  size: number
  sort: SeriesListSort
  order: SortDirection
  libraryId?: number | null
  completionStatus?: CompletionStatus | null
  author?: string | null
}

type ListSeriesBooksParams = {
  page: number
  size: number
  sort: SeriesBookSort
  order: SortDirection
  libraryId?: number | null
}

function toQuery(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '')
  return new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
}

export async function fetchSeries(params: ListSeriesParams): Promise<SeriesPage> {
  const qs = toQuery(params)
  const res = await api(`/api/v1/series?${qs}`)
  if (!res.ok) throw new Error(`Failed to fetch series: ${res.status}`)
  return res.json()
}

export async function fetchSeriesBooks(seriesId: number, params: ListSeriesBooksParams): Promise<SeriesBooksPage> {
  const qs = toQuery(params)
  const res = await api(`/api/v1/series/${seriesId}/books?${qs}`)
  if (!res.ok) throw new Error(`Failed to fetch series books: ${res.status}`)
  return res.json()
}

export async function setSeriesFollowStatus(seriesId: number, status: SeriesFollowStatus): Promise<SeriesFollowStatusResponse> {
  const res = await api(`/api/v1/series/${seriesId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error(`Failed to set series status: ${res.status}`)
  return res.json()
}

export async function clearSeriesFollowStatus(seriesId: number): Promise<void> {
  const res = await api(`/api/v1/series/${seriesId}/status`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to clear series status: ${res.status}`)
}

/** Omit upToBookId to mark the whole series read. */
export async function markSeriesRead(seriesId: number, upToBookId?: number): Promise<MarkSeriesReadResponse> {
  const res = await api(`/api/v1/series/${seriesId}/mark-read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(upToBookId === undefined ? {} : { upToBookId }),
  })
  if (!res.ok) throw new Error(`Failed to mark series read: ${res.status}`)
  return res.json()
}
