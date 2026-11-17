import { api } from '@/lib/api'
import type { TkBackfillPreview, TkConnectFinishPayload, TkConnectStartResult, TkSettings, UpsertTkSettingsPayload } from '@bookorbit/types'

const BASE = '/api/v1/tk'

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}))
  return (body as { message?: string }).message ?? fallback
}

export async function fetchTkSettings(): Promise<TkSettings> {
  const res = await api(`${BASE}/settings`)
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to fetch TK settings'))
  return res.json()
}

export async function upsertTkSettings(payload: UpsertTkSettingsPayload): Promise<TkSettings> {
  const res = await api(`${BASE}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to save settings'))
  return res.json()
}

export async function startTkConnect(clientName?: string): Promise<TkConnectStartResult> {
  const res = await api(`${BASE}/connect/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clientName ? { clientName } : {}),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to start connecting TK'))
  return res.json()
}

export async function finishTkConnect(payload: TkConnectFinishPayload): Promise<TkSettings> {
  const res = await api(`${BASE}/connect/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to finish connecting TK'))
  return res.json()
}

export async function disconnectTk(): Promise<TkSettings> {
  const res = await api(`${BASE}/disconnect`, { method: 'POST' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to disconnect TK'))
  return res.json()
}

export async function previewTkBackfill(): Promise<TkBackfillPreview> {
  const res = await api(`${BASE}/backfill/preview`, { method: 'POST' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to preview backfill'))
  return res.json()
}

export async function requestTkBackfill(): Promise<TkSettings> {
  const res = await api(`${BASE}/backfill`, { method: 'POST' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to start backfill'))
  return res.json()
}
