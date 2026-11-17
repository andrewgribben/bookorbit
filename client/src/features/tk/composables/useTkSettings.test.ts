import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as tkApi from '../api/tk.api'
import { useTkSettings } from './useTkSettings'

vi.mock('../api/tk.api')

describe('useTkSettings', () => {
  beforeEach(() => vi.resetAllMocks())

  it('fetchSettings loads and stores settings', async () => {
    const settings = {
      connected: true,
      enabled: true,
      effectiveEnabled: true,
      disabledReason: null,
      lastSyncedAt: null,
      connectedAt: null,
      backfillRequestedAt: null,
    }
    vi.spyOn(tkApi, 'fetchTkSettings').mockResolvedValue(settings)
    const { settings: settingsRef, error, fetchSettings } = useTkSettings()

    await fetchSettings()

    expect(settingsRef.value).toEqual(settings)
    expect(error.value).toBeNull()
  })

  it('fetchSettings records an error message on failure', async () => {
    vi.spyOn(tkApi, 'fetchTkSettings').mockRejectedValue(new Error('boom'))
    const { error, fetchSettings } = useTkSettings()

    await fetchSettings()

    expect(error.value).toBe('boom')
  })

  it('connectStart returns the authorize URL', async () => {
    vi.spyOn(tkApi, 'startTkConnect').mockResolvedValue({ authorizeUrl: 'https://tk.xyz/auth' })
    const { connectStart } = useTkSettings()

    await expect(connectStart()).resolves.toBe('https://tk.xyz/auth')
  })

  it('connectStart returns null and records the error on failure', async () => {
    vi.spyOn(tkApi, 'startTkConnect').mockRejectedValue(new Error('cannot connect'))
    const { connectStart, error } = useTkSettings()

    await expect(connectStart()).resolves.toBeNull()
    expect(error.value).toBe('cannot connect')
  })

  it('startBackfill stores the returned settings on success', async () => {
    const settings = {
      connected: true,
      enabled: true,
      effectiveEnabled: true,
      disabledReason: null,
      lastSyncedAt: null,
      connectedAt: null,
      backfillRequestedAt: '2026-01-01T00:00:00Z',
    }
    vi.spyOn(tkApi, 'requestTkBackfill').mockResolvedValue(settings)
    const { settings: settingsRef, startBackfill } = useTkSettings()

    await expect(startBackfill()).resolves.toBe(true)
    expect(settingsRef.value).toEqual(settings)
  })

  it('previewBackfill returns null instead of throwing when the request fails', async () => {
    vi.spyOn(tkApi, 'previewTkBackfill').mockRejectedValue(new Error('nope'))
    const { previewBackfill } = useTkSettings()

    await expect(previewBackfill()).resolves.toBeNull()
  })
})
