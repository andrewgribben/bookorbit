import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  setSeriesFollowStatus: vi.fn(),
  clearSeriesFollowStatus: vi.fn(),
  markSeriesRead: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('../../api/series', () => ({
  setSeriesFollowStatus: mocks.setSeriesFollowStatus,
  clearSeriesFollowStatus: mocks.clearSeriesFollowStatus,
  markSeriesRead: mocks.markSeriesRead,
}))
vi.mock('vue-sonner', () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

import { useSeriesFollowActions } from '../useSeriesFollowActions'

describe('useSeriesFollowActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets a status, or clears it when given null', async () => {
    const { setStatus } = useSeriesFollowActions()

    await expect(setStatus(4, 'dropped')).resolves.toBe(true)
    await expect(setStatus(4, null)).resolves.toBe(true)

    expect(mocks.setSeriesFollowStatus).toHaveBeenCalledWith(4, 'dropped')
    expect(mocks.clearSeriesFollowStatus).toHaveBeenCalledWith(4)
  })

  it('marks read up to a book and reports the count', async () => {
    mocks.markSeriesRead.mockResolvedValue({ updated: 3 })
    const { markRead } = useSeriesFollowActions()

    await expect(markRead(4, 90)).resolves.toBe(true)

    expect(mocks.markSeriesRead).toHaveBeenCalledWith(4, 90)
    expect(mocks.toastSuccess).toHaveBeenCalledWith('series.follow.markedRead')
  })

  it('reports failure without throwing', async () => {
    mocks.markSeriesRead.mockRejectedValue(new Error('boom'))
    const { markRead, pending } = useSeriesFollowActions()

    await expect(markRead(4)).resolves.toBe(false)

    expect(mocks.toastError).toHaveBeenCalledWith('series.follow.failed')
    expect(pending.value).toBe(false)
  })
})
