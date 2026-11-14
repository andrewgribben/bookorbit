import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(),
  getAccessToken: vi.fn<() => string | null>(),
}))

const createWebHostMock = vi.hoisted(() => vi.fn<(container: HTMLElement) => unknown>())

vi.mock('reactor', () => ({
  webHost: {
    createWebHost: createWebHostMock,
  },
}))

import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import type { FoliateRenderer } from '../useFoliate'
import { api } from '@/lib/api'
import { useReactor } from '../useReactor'

interface MockHost {
  core: unknown
  on: ReturnType<typeof vi.fn>
  dispatch: ReturnType<typeof vi.fn>
  beginOpen: ReturnType<typeof vi.fn>
  pushChunk: ReturnType<typeof vi.fn>
  commitOpen: ReturnType<typeof vi.fn>
  openLocal: ReturnType<typeof vi.fn>
  setExtraCss: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
}

function makeMockHost(): MockHost {
  const listeners = new Set<(event: unknown) => void>()
  return {
    core: {},
    on: vi.fn<(listener: (event: unknown) => void) => () => void>((listener: (event: unknown) => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }),
    dispatch: vi.fn<(command: unknown) => void>(),
    beginOpen: vi.fn<(meta: unknown) => void>(),
    pushChunk: vi.fn<(bytes: Uint8Array) => void>(),
    commitOpen: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    openLocal: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    setExtraCss: vi.fn<(css: string | null) => void>(),
    destroy: vi.fn<() => void>(),
    // test helper, not part of WebHost
    emit(event: unknown) {
      for (const listener of listeners) listener(event)
    },
  } as unknown as MockHost & { emit: (event: unknown) => void }
}

describe('useReactor', () => {
  let container: HTMLDivElement
  let mockHost: MockHost & { emit: (event: unknown) => void }

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    mockHost = makeMockHost() as MockHost & { emit: (event: unknown) => void }
    createWebHostMock.mockReset()
    createWebHostMock.mockReturnValue(mockHost)

    vi.mocked(api).mockResolvedValue({
      ok: true,
      json: vi.fn<() => Promise<unknown>>().mockResolvedValue({ metadata: { language: 'en-GB' } }),
      arrayBuffer: vi.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(4)),
    } as unknown as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    container.remove()
  })

  it('mounts a WebHost against the container and opens the EPUB using an authenticated fetch', async () => {
    const reactor = useReactor(() => container)

    await reactor.open(1, 2, 'epub', null, undefined)

    expect(createWebHostMock).toHaveBeenCalledWith(container)
    expect(api).toHaveBeenCalledWith('/api/v1/epub/1/info?fileId=2')
    expect(api).toHaveBeenCalledWith('/api/v1/books/files/2/serve')
    expect(mockHost.beginOpen).toHaveBeenCalledWith({ format: 'epub', cfi: null, fraction: null, settings: null, previousCfi: null })
    expect(mockHost.pushChunk).toHaveBeenCalledTimes(1)
    expect(mockHost.commitOpen).toHaveBeenCalledTimes(1)
    expect(reactor.loading.value).toBe(false)
    expect(reactor.error.value).toBeNull()
    expect(reactor.bookLanguage.value).toBe('en')
  })

  it('navigates to the requested CFI after opening', async () => {
    const reactor = useReactor(() => container)

    await reactor.open(1, 2, 'epub', 'epubcfi(/6/2!)', undefined)

    expect(mockHost.dispatch).toHaveBeenCalledWith({ type: 'goTo', target: 'epubcfi(/6/2!)' })
  })

  it('falls back to a fraction when no CFI is given', async () => {
    const reactor = useReactor(() => container)

    await reactor.open(1, 2, 'epub', null, 0.42)

    expect(mockHost.dispatch).toHaveBeenCalledWith({ type: 'goToFraction', value: 0.42 })
  })

  it('maps a relocate event into the shared RelocateDetail shape and calls onRelocate', async () => {
    const onRelocate = vi.fn<(detail: unknown) => void>()
    const reactor = useReactor(() => container, onRelocate)

    await reactor.open(1, 2, 'epub', null, undefined)
    mockHost.emit({
      type: 'relocate',
      cfi: 'epubcfi(/6/4!)',
      fraction: 0.5,
      chapterTitle: 'Chapter One',
      location: { current: 1, next: 2, total: 10 },
      reason: 'page',
      restoring: false,
      narrationFragment: null,
      narrationSectionIndex: null,
    })

    expect(reactor.fraction.value).toBe(0.5)
    expect(onRelocate).toHaveBeenCalledWith({
      reason: 'page',
      restoring: false,
      cfi: 'epubcfi(/6/4!)',
      fraction: 0.5,
      tocItem: { label: 'Chapter One' },
      location: { current: 1, next: 2, total: 10 },
    })
  })

  it('maps reader settings (including the new letter/word-spacing fields) through applyStyles and setExtraCss', async () => {
    let capturedRenderer: FoliateRenderer | null = null
    const onApplyStyles = vi.fn<(renderer: typeof capturedRenderer) => void>((renderer) => {
      capturedRenderer = renderer
    })
    const reactor = useReactor(() => container, undefined, onApplyStyles)

    await reactor.open(1, 2, 'epub', null, undefined)
    mockHost.emit({ type: 'loaded', toc: [], hasMediaOverlay: false, isRtl: false, metadata: { title: null, language: null } })

    expect(onApplyStyles).toHaveBeenCalled()
    expect(capturedRenderer).not.toBeNull()

    capturedRenderer!.setAttribute('max-column-count', '2')
    capturedRenderer!.setAttribute('gap', '5%')
    capturedRenderer!.setAttribute('max-inline-size', '720px')
    capturedRenderer!.setAttribute('max-block-size', '1440px')
    capturedRenderer!.setAttribute('margin', '40px')
    capturedRenderer!.setAttribute('flow', 'paginated')
    capturedRenderer!.setStyles?.('body { letter-spacing: 0.02em !important; }')

    expect(mockHost.dispatch).toHaveBeenCalledWith({
      type: 'applyStyles',
      settings: expect.objectContaining({
        maxColumnCount: 2,
        gap: 0.05,
        maxInlineSize: 720,
        maxBlockSize: 1440,
        flow: 'paginated',
        marginTop: 40,
        marginBottom: 40,
        marginLeft: 40,
        marginRight: 40,
      }),
    })
    expect(mockHost.setExtraCss).toHaveBeenCalledWith('body { letter-spacing: 0.02em !important; }')
  })

  it('round-trips annotations through setAnnotations commands', async () => {
    const reactor = useReactor(() => container)
    await reactor.open(1, 2, 'epub', null, undefined)
    mockHost.dispatch.mockClear()

    reactor.addAnnotation('epubcfi(/6/4)', '#FACC15', 'highlight')
    expect(mockHost.dispatch).toHaveBeenLastCalledWith({
      type: 'setAnnotations',
      items: [{ cfi: 'epubcfi(/6/4)', color: '#FACC15', style: 'highlight' }],
    })

    reactor.addAnnotations([{ cfi: 'epubcfi(/6/8)', color: '#00FF00', style: 'underline' }])
    expect(mockHost.dispatch).toHaveBeenLastCalledWith({
      type: 'setAnnotations',
      items: [
        { cfi: 'epubcfi(/6/4)', color: '#FACC15', style: 'highlight' },
        { cfi: 'epubcfi(/6/8)', color: '#00FF00', style: 'underline' },
      ],
    })

    reactor.redrawAnnotation('epubcfi(/6/4)', '#FF0000', 'strikethrough')
    expect(mockHost.dispatch).toHaveBeenLastCalledWith({
      type: 'setAnnotations',
      items: [
        { cfi: 'epubcfi(/6/4)', color: '#FF0000', style: 'strikethrough' },
        { cfi: 'epubcfi(/6/8)', color: '#00FF00', style: 'underline' },
      ],
    })

    reactor.deleteAnnotation('epubcfi(/6/8)')
    expect(mockHost.dispatch).toHaveBeenLastCalledWith({
      type: 'setAnnotations',
      items: [{ cfi: 'epubcfi(/6/4)', color: '#FF0000', style: 'strikethrough' }],
    })
  })

  it('destroys the previous host and unmounts the host on unmount', async () => {
    const reactor = useReactor(() => container)
    await reactor.open(1, 2, 'epub', null, undefined)
    const firstHost = mockHost

    const secondHost = makeMockHost() as MockHost & { emit: (event: unknown) => void }
    createWebHostMock.mockReturnValue(secondHost)
    await reactor.open(1, 2, 'epub', null, undefined)

    expect(firstHost.destroy).toHaveBeenCalledTimes(1)
  })

  it('destroys the host when the owning component unmounts', async () => {
    let reactorInstance!: ReturnType<typeof useReactor>
    const TestComponent = defineComponent({
      setup() {
        reactorInstance = useReactor(() => container)
        return () => h('div')
      },
    })

    const wrapper = mount(TestComponent)
    await reactorInstance.open(1, 2, 'epub', null, undefined)
    expect(mockHost.destroy).not.toHaveBeenCalled()

    wrapper.unmount()

    expect(mockHost.destroy).toHaveBeenCalledTimes(1)
  })
})
