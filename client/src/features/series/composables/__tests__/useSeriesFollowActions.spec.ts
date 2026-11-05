import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  setSeriesFollowStatus: vi.fn(),
  clearSeriesFollowStatus: vi.fn(),
  markSeriesRead: vi.fn(),
  markSeriesUnread: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('../../api/series', () => ({
  setSeriesFollowStatus: mocks.setSeriesFollowStatus,
  clearSeriesFollowStatus: mocks.clearSeriesFollowStatus,
  markSeriesRead: mocks.markSeriesRead,
  markSeriesUnread: mocks.markSeriesUnread,
}))
vi.mock('vue-sonner', () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

import { onSeriesFollowChanged, useSeriesFollowActions } from '../useSeriesFollowActions'

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

  it('marks unread from a book and tells listeners the series changed', async () => {
    mocks.markSeriesUnread.mockResolvedValue({ updated: 2 })
    const listener = vi.fn()
    const stop = onSeriesFollowChanged(listener)
    const { markUnreadFrom } = useSeriesFollowActions()

    await expect(markUnreadFrom(4, 91)).resolves.toBe(true)
    stop()

    expect(mocks.markSeriesUnread).toHaveBeenCalledWith(4, 91)
    expect(mocks.toastSuccess).toHaveBeenCalledWith('series.follow.markedUnread')
    expect(listener).toHaveBeenCalledWith(4)
  })

  it('does not notify listeners when the request fails', async () => {
    mocks.markSeriesUnread.mockRejectedValue(new Error('boom'))
    const listener = vi.fn()
    const stop = onSeriesFollowChanged(listener)

    await useSeriesFollowActions().markUnreadFrom(4, 91)
    stop()

    expect(listener).not.toHaveBeenCalled()
  })
})
