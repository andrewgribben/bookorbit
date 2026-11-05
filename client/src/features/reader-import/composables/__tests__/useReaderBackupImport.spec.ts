import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ api: vi.fn<(url: string, init?: RequestInit) => Promise<Response>>() }))
vi.mock('@/lib/api', () => ({ api: mocks.api }))

import { useReaderBackupImport } from '../useReaderBackupImport'

const plan = { applied: false, libraryEntries: 1, series: [], numberMatches: [], unmatched: [] }

describe('useReaderBackupImport', () => {
  beforeEach(() => {
    mocks.api.mockReset()
  })

  it('previews then applies by uploading the same file again', async () => {
    mocks.api
      .mockResolvedValueOnce(new Response(JSON.stringify(plan)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...plan, applied: true })))
    const importer = useReaderBackupImport()
    importer.selectFile(new File(['backup'], 'app.tachibk'))

    await expect(importer.preview()).resolves.toBe(true)
    expect(importer.result.value?.applied).toBe(false)
    await expect(importer.apply()).resolves.toBe(true)

    expect(mocks.api.mock.calls.map(([url]) => url)).toEqual(['/api/v1/reader-import/mihon', '/api/v1/reader-import/mihon?apply=true'])
    expect((mocks.api.mock.calls[1]![1]!.body as FormData).get('file')).toBeInstanceOf(File)
    expect(importer.result.value?.applied).toBe(true)
  })

  it('shows the server message when the file is rejected', async () => {
    mocks.api.mockResolvedValue(new Response(JSON.stringify({ message: 'No series found in this backup' }), { status: 400 }))
    const importer = useReaderBackupImport()
    importer.selectFile(new File(['x'], 'notes.csv'))

    await expect(importer.preview()).resolves.toBe(false)
    expect(importer.error.value).toBe('No series found in this backup')
    expect(importer.result.value).toBeNull()
  })

  it('does nothing without a file', async () => {
    await expect(useReaderBackupImport().preview()).resolves.toBe(false)
    expect(mocks.api).not.toHaveBeenCalled()
  })
})
