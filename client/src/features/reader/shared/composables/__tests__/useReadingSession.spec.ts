import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useReadingSession } from '../useReadingSession'

const apiMock = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<unknown>>())
vi.mock('@/lib/api', () => ({ api: apiMock }))

describe('useReadingSession - elapsedMinutes', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    apiMock.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts elapsedMinutes at 0', () => {
    const { elapsedMinutes } = useReadingSession(1, () => ({ percentage: 0 }))
    expect(elapsedMinutes.value).toBe(0)
  })

  it('updates elapsedMinutes after onActivity and elapsed time', async () => {
    const { onActivity, elapsedMinutes } = useReadingSession(1, () => ({ percentage: 10 }))

    onActivity()
    expect(elapsedMinutes.value).toBe(0)

    // Advance 2 minutes
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
    onActivity()

    // After the 30-second interval update
    await vi.advanceTimersByTimeAsync(30 * 1000)

    expect(elapsedMinutes.value).toBeGreaterThanOrEqual(2)
  })

  it('resets elapsedMinutes to 0 when session ends', async () => {
    const { onActivity, elapsedMinutes, endSession } = useReadingSession(1, () => ({ percentage: 10 }))

    onActivity()
    await vi.advanceTimersByTimeAsync(60 * 1000)
    onActivity()
    await vi.advanceTimersByTimeAsync(30 * 1000)

    expect(elapsedMinutes.value).toBeGreaterThanOrEqual(1)

    endSession()
    expect(elapsedMinutes.value).toBe(0)
  })

  it('pauses elapsed tracking when visibility is hidden', async () => {
    const { onActivity, elapsedMinutes } = useReadingSession(1, () => ({ percentage: 10 }))

    onActivity()
    await vi.advanceTimersByTimeAsync(60 * 1000)

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    const elapsed1 = elapsedMinutes.value

    // Time passes while hidden
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

    // Elapsed should not have increased significantly (only from the interval that ran before pause)
    expect(elapsedMinutes.value).toBeLessThanOrEqual(elapsed1 + 1)

    // Restore visibility
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })

  it('starts a new session after idle timeout', async () => {
    const { onActivity, elapsedMinutes } = useReadingSession(1, () => ({ percentage: 10 }))

    onActivity()
    await vi.advanceTimersByTimeAsync(60 * 1000)
    onActivity()
    await vi.advanceTimersByTimeAsync(30 * 1000)

    const elapsed = elapsedMinutes.value
    expect(elapsed).toBeGreaterThanOrEqual(1)

    // Wait for idle timeout (5 minutes)
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1000)

    // After idle timeout, session ends, elapsedMinutes resets
    expect(elapsedMinutes.value).toBe(0)

    // New activity starts a new session
    onActivity()
    expect(elapsedMinutes.value).toBe(0)
  })

  it('does not track elapsed time or save sessions when tracking is disabled', async () => {
    const trackingEnabled = ref(false)
    const { onActivity, elapsedMinutes, endSession } = useReadingSession(1, () => ({ percentage: 10 }), { trackingEnabled })

    onActivity()
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
    endSession()

    expect(elapsedMinutes.value).toBe(0)
    expect(apiMock).not.toHaveBeenCalled()
  })
})

describe('useReadingSession - session gap rule', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    apiMock.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function setHidden() {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }

  function setVisible() {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }

  it('resumes the same session for a gap under 10 minutes and does not count the gap', async () => {
    const { onActivity, endSession } = useReadingSession(1, () => ({ percentage: 10 }))

    onActivity()
    await vi.advanceTimersByTimeAsync(60 * 1000)

    setHidden()
    // Gap of 3 minutes - under the 10 minute threshold.
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000)
    setVisible()

    onActivity()
    await vi.advanceTimersByTimeAsync(60 * 1000)
    endSession()

    // Only one session was ever saved, so the 3-minute gap resumed it rather than
    // closing it and starting a second one.
    expect(apiMock).toHaveBeenCalledTimes(1)
    const [, init] = apiMock.mock.calls[0] as [string, { body: string }]
    const body = JSON.parse(init.body) as Record<string, unknown>
    // Active time is ~2 minutes (1 before + 1 after the hidden gap); the 3-minute
    // gap itself must not be counted as reading time.
    expect(body.durationSeconds as number).toBeLessThan(3 * 60)
  })

  it('closes the session at the last activity time after a gap over 10 minutes, then starts a new one', async () => {
    const { onActivity, endSession } = useReadingSession(1, () => ({ percentage: 10 }))

    onActivity()
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000)

    setHidden()
    const pausedAtMs = Date.now()

    // Gap of 11 minutes - over the 10 minute threshold.
    await vi.advanceTimersByTimeAsync(11 * 60 * 1000)
    setVisible()

    // The old session must already have been saved on becoming visible again,
    // with endedAt set to the moment it went hidden, not the time it was resumed.
    expect(apiMock).toHaveBeenCalledTimes(1)
    const [, firstInit] = apiMock.mock.calls[0] as [string, { body: string }]
    const firstBody = JSON.parse(firstInit.body) as Record<string, unknown>
    expect(firstBody.endedAt).toBe(new Date(pausedAtMs).toISOString())

    // The next reading signal starts a brand-new session.
    onActivity()
    expect(apiMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60 * 1000)
    endSession()

    expect(apiMock).toHaveBeenCalledTimes(2)
    const [, secondInit] = apiMock.mock.calls[1] as [string, { body: string }]
    const secondBody = JSON.parse(secondInit.body) as Record<string, unknown>
    expect(secondBody.sessionId).not.toBe(firstBody.sessionId)
  })

  it('still ends the session after 5 minutes idle while visible (unchanged threshold)', async () => {
    const { onActivity, elapsedMinutes } = useReadingSession(1, () => ({ percentage: 10 }))

    onActivity()
    await vi.advanceTimersByTimeAsync(60 * 1000)
    onActivity()

    // Just under the 5-minute idle threshold - session must still be open.
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 - 1000)
    expect(apiMock).not.toHaveBeenCalled()

    // Crossing the 5-minute idle threshold ends the session (far short of the
    // 10-minute session-gap threshold, confirming the two are independent).
    await vi.advanceTimersByTimeAsync(2000)
    expect(elapsedMinutes.value).toBe(0)
    expect(apiMock).toHaveBeenCalledTimes(1)
  })
})

describe('useReadingSession - sessionType', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    apiMock.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  async function savedBody(options?: Parameters<typeof useReadingSession>[2]): Promise<Record<string, unknown>> {
    const { onActivity, endSession } = useReadingSession(7, () => ({ percentage: 10 }), options)
    onActivity()
    await vi.advanceTimersByTimeAsync(20 * 1000)
    endSession()
    expect(apiMock).toHaveBeenCalledTimes(1)
    const [url, init] = apiMock.mock.calls[0] as [string, { body: string }]
    expect(url).toBe('/api/v1/books/files/7/sessions')
    return JSON.parse(init.body) as Record<string, unknown>
  }

  it('omits sessionType by default so the server records a read session', async () => {
    const body = await savedBody()
    expect(body).not.toHaveProperty('sessionType')
    expect(body).not.toHaveProperty('source')
  })

  it('sends the configured sessionType', async () => {
    const body = await savedBody({ sessionType: 'listen' })
    expect(body.sessionType).toBe('listen')
    expect(body).not.toHaveProperty('source')
  })
})
