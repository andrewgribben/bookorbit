import { api } from '@/lib/api'
import type {
  ReadingServiceDeviceAuthPollResult,
  ReadingServiceDeviceAuthStart,
  ReadingServicePasswordLoginResult,
  ReadingServiceProvider,
} from '@bookorbit/types'

const BASE = '/api/v1/reading-services'

export class ReadingServiceAuthRateLimitedError extends Error {
  constructor(public readonly retryAfterSeconds: number | null) {
    super('Too many sign-in attempts')
  }
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}))
  return (body as { message?: string }).message ?? fallback
}

function parseRetryAfter(res: Response): number | null {
  const header = res.headers.get('retry-after')
  if (!header) return null
  const seconds = Number.parseInt(header, 10)
  return Number.isFinite(seconds) ? seconds : null
}

export async function connectReadingServiceWithToken(
  provider: ReadingServiceProvider,
  credential: string,
): Promise<{ ok: boolean; accountLabel: string | null }> {
  const res = await api(`${BASE}/${provider}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  })
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not connect with that token'))
  return res.json()
}

export async function connectReadingServiceWithPassword(
  provider: ReadingServiceProvider,
  username: string,
  password: string,
): Promise<ReadingServicePasswordLoginResult> {
  const res = await api(`${BASE}/${provider}/auth/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (res.status === 429) throw new ReadingServiceAuthRateLimitedError(parseRetryAfter(res))
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not sign in'))
  return res.json()
}

export async function startReadingServiceDeviceAuth(provider: ReadingServiceProvider): Promise<ReadingServiceDeviceAuthStart> {
  const res = await api(`${BASE}/${provider}/auth/device/start`, { method: 'POST' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not start device sign-in'))
  return res.json()
}

export async function pollReadingServiceDeviceAuth(provider: ReadingServiceProvider): Promise<ReadingServiceDeviceAuthPollResult> {
  const res = await api(`${BASE}/${provider}/auth/device/poll`, { method: 'POST' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not check device sign-in'))
  return res.json()
}

export async function disconnectReadingService(provider: ReadingServiceProvider): Promise<{ ok: true }> {
  const res = await api(`${BASE}/${provider}/auth`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await errorMessage(res, 'Could not disconnect'))
  return res.json()
}
