import { onUnmounted, ref } from 'vue'
import { webHost } from 'reactor'
import type { webHost as WebHostNamespace } from 'reactor'
type WebHost = WebHostNamespace.WebHost
import { api } from '@/lib/api'
import { i18n } from '@/i18n'
import type { EpubBookInfo } from '@bookorbit/types'
import type { EpubOpenOptions, FoliateLocationContext, FoliateMediaOverlay, FoliateOpenOptions, FoliateRenderer, RelocateDetail } from './useFoliate'
import type { SelectionDetail } from './useFoliateSelection'

/**
 * Reactor-backed EPUB engine (W1-B2, docs/plans/W1.md). Exposes the exact same public surface as
 * `useFoliate` so `ReaderView.vue` and its sibling composables (`useToc`, `useSearch`, annotation
 * actions) never need to know which engine is mounted - only `epub/engine.ts`'s build-time flag
 * decides which of the two composables `ReaderView.vue` calls.
 *
 * Known gaps versus `useFoliate` while `VITE_READER_ENGINE=reactor` is on (see docs/plans/W1.md
 * section 2 "Gaps to file as Reactor tasks" and section 9's standing decisions):
 * - No true lazy/streaming EPUB open. Reactor's `openLocal` expects a zip-entries listing shaped
 *   like `src/vendor/foliate/local-zip-loader.js` (an `entries.json` + per-entry `entry/<name>`
 *   URL contract), which BookOrbit's `/api/v1/epub` routes do not expose. This composable instead
 *   fetches the whole EPUB file once (same pattern `useFoliate` already uses for non-EPUB
 *   formats) and feeds it through `beginOpen`/`pushChunk`/`commitOpen`. Larger books use more
 *   peak memory than the foliate path until a matching lazy-entries endpoint exists (R-G5).
 * - `isFixedLayout` is always `false`: Reactor's v1 `loaded` event does not report whether the
 *   opened book is pre-paginated (no equivalent of `useFoliate`'s `rendition.layout` check).
 * - Media overlay (embedded narration) is unavailable: `getMediaOverlay`/`startMediaOverlay`
 *   return `null`/no-op. Reactor's narration primitive is a different command/event shape
 *   (`narrationPrepare`/`narrationHighlight`/`narrationTimeline`) that B5 would need to wire up;
 *   out of scope here (R-G6).
 * - Synthesized TTS block-highlighting has no Reactor equivalent at all (R-G4). Per the plan's
 *   standing decision (section 9.5), TTS is a known regression while this flag is on; this
 *   composable does nothing to enable or disable it - `ReaderView.vue`'s TTS composables keep
 *   reaching into `useFoliateTts`'s direct-DOM-access layer, which has no renderer to attach to
 *   on this path and should be treated as non-functional behind the flag.
 * - Kobo/KOReader progress-sync fields, section index/total and elapsed time are not carried by
 *   Reactor's v1 `relocate` event (R-G2); only `cfi`, `fraction` and `chapterTitle` are populated.
 * - Tap-zone/input parity (swipe, hold-to-select suppression, `suppressNextTapNavigation`) is not
 *   reproduced. Only a simple centre-zone heuristic drives `onMiddleTap`.
 * - `getSectionFractions`, `getLocationContext`'s fraction lookup, and `getCFI`-based selection
 *   resolution have no Reactor equivalent exposed on `WebHost`; they degrade to `[]`/`null`.
 */

export interface ReactorSearchSection {
  label?: string
  subitems?: { cfi?: string; excerpt?: { pre: string; match: string; post: string } }[]
}

interface ReactorView {
  search(opts: { query: string }): AsyncIterable<ReactorSearchSection>
  clearSearch(): void
}

export function useReactor(
  container: () => HTMLElement | null,
  onRelocate?: (detail: RelocateDetail) => void,
  onApplyStyles?: (renderer: FoliateRenderer) => void,
  onMiddleTap?: () => void,
  onChapterLoad?: (doc: Document, viewEl: HTMLElement) => void,
  _canNavigate?: () => boolean,
) {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const fraction = ref(0)
  const viewRef = ref<unknown>(null)
  const bookLanguage = ref<string>('en')
  const isFixedLayout = ref(false)
  const hasMediaOverlay = ref(false)

  let host: WebHost | null = null
  let unsubscribe: (() => void) | null = null
  let toc: unknown[] = []
  let onAnnotationClick: ((cfi: string, popupPosition: { x: number; y: number; showBelow: boolean }) => void) | null = null
  let onTextSelected: ((detail: SelectionDetail) => void) | null = null
  const annotationStyles = new Map<string, { color: string; style: string }>()

  function setAnnotationClickHandler(fn: (cfi: string, popupPosition: { x: number; y: number; showBelow: boolean }) => void) {
    onAnnotationClick = fn
  }

  function setTextSelectedHandler(fn: (detail: SelectionDetail) => void) {
    onTextSelected = fn
  }

  function setSelectionInteractionStartHandler(_fn: () => void) {
    // No equivalent event on WebHost (selection start vs selection-cleared only); no-op.
  }

  function pushAnnotations() {
    if (!host) return
    const items = Array.from(annotationStyles.entries()).map(([cfi, { color, style }]) => ({ cfi, color, style }))
    host.dispatch({ type: 'setAnnotations', items })
  }

  function addAnnotation(cfi: string, color = '#FACC15', style = 'highlight') {
    annotationStyles.set(cfi, { color, style })
    pushAnnotations()
  }

  function addAnnotations(anns: { cfi: string; color: string; style: string }[]) {
    for (const ann of anns) annotationStyles.set(ann.cfi, { color: ann.color, style: ann.style })
    pushAnnotations()
  }

  function deleteAnnotation(cfi: string) {
    annotationStyles.delete(cfi)
    pushAnnotations()
  }

  function redrawAnnotation(cfi: string, color: string, style: string) {
    annotationStyles.set(cfi, { color, style })
    pushAnnotations()
  }

  /** R-G7: `renderer.setStyles(css)` is the last call in `useReaderState.applyToRenderer`'s
   * sequence; this shim collects the preceding `setAttribute` layout calls, maps them onto a v1
   * `ReaderSettings` object (defaulting every field `useReaderState` applies via raw CSS instead
   * of an attribute, since that CSS always lands in `setExtraCss` right after), dispatches
   * `applyStyles`, then forwards the full generated CSS string - including `useReaderState`'s own
   * font-face block - through `setExtraCss`. */
  function makeRendererShim(): FoliateRenderer {
    let attrs: Record<string, string> = {}
    return {
      setAttribute(name: string, value: string) {
        attrs[name] = value
      },
      removeAttribute(name: string) {
        delete attrs[name]
      },
      setStyles(css: string) {
        if (!host) return
        const margin = attrs.margin ? parseFloat(attrs.margin) || 0 : 0
        host.dispatch({
          type: 'applyStyles',
          settings: {
            fontSize: 16,
            lineHeight: 1.5,
            fontFamily: null,
            paragraphSpacing: 0,
            maxColumnCount: Number(attrs['max-column-count'] ?? 1),
            gap: parseFloat(attrs.gap ?? '0%') / 100,
            maxInlineSize: parseInt(attrs['max-inline-size'] ?? '720', 10),
            maxBlockSize: parseInt(attrs['max-block-size'] ?? '1440', 10),
            justify: true,
            hyphenate: true,
            isDark: false,
            themeName: 'default',
            flow: attrs.flow === 'scrolled' ? 'scrolled' : 'paginated',
            useBookLayout: true,
            marginTop: margin,
            marginBottom: margin,
            marginLeft: margin,
            marginRight: margin,
            linkSideMargins: true,
          },
        })
        host.setExtraCss(css)
        attrs = {}
      },
    }
  }

  const rendererShim = makeRendererShim()

  function makeViewShim(): ReactorView {
    return {
      search: (opts) => runSearch(opts.query),
      clearSearch: () => host?.dispatch({ type: 'clearSearch' }),
    }
  }

  async function* runSearch(query: string): AsyncGenerator<ReactorSearchSection> {
    if (!host) return
    const queue: ReactorSearchSection[] = []
    let resolveNext: (() => void) | null = null
    let done = false

    const off = host.on((event) => {
      if (event.type === 'searchResults') {
        queue.push({
          label: event.label,
          subitems: event.items.map((item) => ({ cfi: item.cfi, excerpt: { pre: item.pre, match: item.match, post: item.post } })),
        })
        resolveNext?.()
      } else if (event.type === 'searchDone') {
        done = true
        resolveNext?.()
      }
    })

    try {
      host.dispatch({ type: 'search', query })
      while (!done || queue.length > 0) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            resolveNext = resolve
          })
          resolveNext = null
          continue
        }
        yield queue.shift()!
      }
    } finally {
      off()
    }
  }

  function destroyHost() {
    unsubscribe?.()
    unsubscribe = null
    host?.destroy()
    host = null
    viewRef.value = null
  }

  function middleTapZone(x: number, y: number): boolean {
    const el = container()
    if (!el) return false
    const rect = el.getBoundingClientRect()
    const relX = (x - rect.left) / Math.max(rect.width, 1)
    const relY = (y - rect.top) / Math.max(rect.height, 1)
    return relX > 0.3 && relX < 0.7 && relY > 0.3 && relY < 0.7
  }

  async function open(
    bookId: number,
    fileId: number,
    format: string,
    optionsOrCfi: FoliateOpenOptions | string | null = {},
    fallbackFraction?: number,
    epubOptions?: EpubOpenOptions,
  ) {
    const options: FoliateOpenOptions =
      typeof optionsOrCfi === 'object' && optionsOrCfi !== null ? optionsOrCfi : { ...epubOptions, cfi: optionsOrCfi, fallbackFraction }
    const el = container()
    if (!el) return

    loading.value = true
    error.value = null
    isFixedLayout.value = false
    hasMediaOverlay.value = false

    destroyHost()
    host = webHost.createWebHost(el)
    viewRef.value = makeViewShim()

    const loadTimeoutId = setTimeout(() => {
      if (loading.value) {
        error.value = i18n.global.t('reader.bookLoadTimeout')
        loading.value = false
      }
    }, 30_000)

    unsubscribe = host.on((event) => {
      switch (event.type) {
        case 'loaded': {
          toc = event.toc
          hasMediaOverlay.value = event.hasMediaOverlay
          clearTimeout(loadTimeoutId)
          onApplyStyles?.(rendererShim)
          if (el.firstElementChild) onChapterLoad?.(el.ownerDocument, el.firstElementChild as HTMLElement)
          break
        }
        case 'relocate': {
          fraction.value = event.fraction ?? 0
          onRelocate?.({
            reason: event.reason ?? undefined,
            restoring: event.restoring,
            cfi: event.cfi,
            fraction: event.fraction ?? undefined,
            tocItem: event.chapterTitle ? { label: event.chapterTitle } : undefined,
            location: event.location as RelocateDetail['location'],
          })
          break
        }
        case 'error': {
          clearTimeout(loadTimeoutId)
          error.value = event.message
          loading.value = false
          break
        }
        case 'selection': {
          const { left, top, right, bottom } = event.rect
          const showBelow = top < 120
          const x = Math.max(100, Math.min((left + right) / 2, window.innerWidth - 150))
          const y = showBelow ? bottom + 10 : top - 50
          onTextSelected?.({ text: event.text, cfi: event.cfi, range: null, popupPosition: { x, y, showBelow } })
          break
        }
        case 'annotationTap': {
          if (!event.cfi || !onAnnotationClick) break
          const rect = event.rect
          const x = rect ? Math.max(100, Math.min((rect.left + rect.right) / 2, window.innerWidth - 150)) : window.innerWidth / 2
          const showBelow = rect ? rect.top < 120 : false
          const y = rect ? (showBelow ? rect.bottom + 10 : rect.top - 50) : 100
          onAnnotationClick(event.cfi, { x, y, showBelow })
          break
        }
        case 'tap': {
          if (middleTapZone(event.x, event.y)) onMiddleTap?.()
          break
        }
        default:
          break
      }
    })

    try {
      let bookLanguageRaw: unknown
      if (format === 'epub') {
        const infoRes = await api(`/api/v1/epub/${bookId}/info?fileId=${fileId}`)
        if (!infoRes.ok) throw new Error(`Failed to fetch EPUB info: ${infoRes.status}`)
        const bookInfo = (await infoRes.json()) as EpubBookInfo
        bookLanguageRaw = bookInfo?.metadata?.language
      }
      bookLanguage.value = typeof bookLanguageRaw === 'string' && bookLanguageRaw ? (bookLanguageRaw.split('-')[0] ?? 'en').toLowerCase() : 'en'

      const fileRes = await api(`/api/v1/books/files/${fileId}/serve`)
      if (!fileRes.ok) throw new Error(`Failed to fetch book file: ${fileRes.status}`)
      const bytes = new Uint8Array(await fileRes.arrayBuffer())

      host.beginOpen({ format, cfi: null, fraction: null, settings: null, previousCfi: null })
      host.pushChunk(bytes)
      await host.commitOpen()

      const navigateTo = async (target: string | number | null | undefined): Promise<boolean> => {
        if (target === null || target === undefined) return false
        try {
          host!.dispatch({ type: 'goTo', target: String(target) })
          return true
        } catch {
          return false
        }
      }

      let didNavigate = false
      if (!didNavigate && options.cfi) {
        didNavigate = await navigateTo(options.cfi)
      }
      if (!didNavigate && options.fallbackFraction !== undefined && options.fallbackFraction > 0) {
        host.dispatch({ type: 'goToFraction', value: options.fallbackFraction })
        didNavigate = true
      }
      if (!didNavigate && options.fallbackFraction === 0) {
        didNavigate = await navigateTo(0)
      }
      if (!didNavigate && options.mediaOverlayFragment) {
        didNavigate = await navigateTo(options.mediaOverlayFragment)
      }

      loading.value = false
    } catch (e) {
      console.error('[useReactor]', e)
      clearTimeout(loadTimeoutId)
      error.value = e instanceof Error && e.message ? e.message : i18n.global.t('reader.failedToLoadBook')
      loading.value = false
    }
  }

  async function getLocationContext(_target: string): Promise<FoliateLocationContext> {
    // No Reactor equivalent of `resolveNavigation`/`getTOCItemOf` exposed on WebHost; best-effort.
    return { chapterTitle: null, fraction: null }
  }

  onUnmounted(destroyHost)

  return {
    loading,
    error,
    fraction,
    bookLanguage,
    isFixedLayout,
    hasMediaOverlay,
    getMediaOverlay: (): FoliateMediaOverlay | null => null,
    startMediaOverlay: (): unknown => undefined,
    getMediaActiveClass: (): string | null => null,
    view: viewRef,
    open,
    prev: () => host?.dispatch({ type: 'prev' }),
    next: () => host?.dispatch({ type: 'next' }),
    goTo: (t: string | number) => {
      host?.dispatch({ type: 'goTo', target: String(t) })
      return Promise.resolve({ index: 0 })
    },
    goToFraction: (f: number) => host?.dispatch({ type: 'goToFraction', value: f }),
    goToSection: (i: number) => {
      host?.dispatch({ type: 'goTo', target: String(i) })
      return Promise.resolve({ index: i })
    },
    getSectionFractions: (): number[] => [],
    getChapters: (): unknown[] => toc,
    getRenderer: (): FoliateRenderer | null => rendererShim,
    getLocationContext,
    addAnnotation,
    addAnnotations,
    deleteAnnotation,
    redrawAnnotation,
    setTextSelectedHandler,
    setSelectionInteractionStartHandler,
    setAnnotationClickHandler,
  }
}
