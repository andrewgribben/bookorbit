import { describe, expect, it, vi } from 'vitest'

describe('epub/engine', () => {
  it('defaults to foliate when VITE_READER_ENGINE is unset', async () => {
    vi.stubEnv('VITE_READER_ENGINE', '')
    vi.resetModules()
    const { READER_ENGINE, isReactorEngine } = await import('../engine')

    expect(READER_ENGINE).toBe('foliate')
    expect(isReactorEngine()).toBe(false)
  })

  it('selects reactor only when VITE_READER_ENGINE is exactly "reactor"', async () => {
    vi.stubEnv('VITE_READER_ENGINE', 'reactor')
    vi.resetModules()
    const { READER_ENGINE, isReactorEngine } = await import('../engine')

    expect(READER_ENGINE).toBe('reactor')
    expect(isReactorEngine()).toBe(true)
  })

  it('falls back to foliate for any other value', async () => {
    vi.stubEnv('VITE_READER_ENGINE', 'something-else')
    vi.resetModules()
    const { READER_ENGINE } = await import('../engine')

    expect(READER_ENGINE).toBe('foliate')
  })
})
