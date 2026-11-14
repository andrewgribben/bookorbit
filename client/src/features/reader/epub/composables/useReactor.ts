import { onUnmounted, ref } from 'vue'
import { webHost, shell } from 'reactor'
import type { webHost as WebHostNamespace } from 'reactor'
type WebHost = WebHostNamespace.WebHost
import { api } from '@/lib/api'
import { i18n } from '@/i18n'
import type { EpubBookInfo } from '@bookorbit/types'
import type { EpubOpenOptions, FoliateLocationContext, FoliateMediaOverlay, FoliateOpenOptions, FoliateRenderer, RelocateDetail } from './useFoliate'
import type { SelectionDetail } from './useFoliateSelection'
import { deriveSectionProgress, getSectionFractions as deriveSectionFractions, type ReactorSectionLike } from '../lib/reactor-section-progress'

/** Matches `useFoliateInput`'s own suppression window (double-click threshold + 100ms), so a tap
 * that lands on an annotation does not also turn the page underneath the popup it just opened. */
const ANNOTATION_TAP_SUPPRESSION_MS = 400
/** Matches `useFoliateInput`'s own swipe/tap navigation debounce. */
const NAVIGATION_DEBOUNCE_MS = 300

/**
 * Reactor-backed EPUB engine (W1-B2, docs/plans/W1.md). Exposes the exact same public surface as
 * `useFoliate` so `ReaderView.vue` and its sibling composables (`useToc`, `useSearch`, annotation
 * actions) never need to know which engine is mounted - only the build-time `VITE_READER_ENGINE` check in ReaderView.vue
 * decides which of the two composables `ReaderView.vue` calls.
 *
 * Known gaps versus `useFoliate` while `VITE_READER_ENGINE=reactor` is on (see docs/plans/W1.md
 * section 2 "Gaps to file as Reactor tasks" and section 9's standing decisions):
 * - Lazy EPUB open (R-G5, resolved by Reactor BO-41): this composable calls `host.openRemote`
 *   against the book file's own `/api/v1/books/files/:fileId/serve` URL, which already supports
 *   HTTP Range (`fileValidators`/`planFileResponse` in the server's `book.controller.ts`). There
 *   is no server-side entries manifest (unlike `openLocal`, which BookOrbit's routes do not
 *   expose) - Reactor reads the zip's central directory and each opened entry's bytes lazily via
 *   Range requests on that one URL, so peak memory stays proportional to the current section
 *   rather than the whole book. The `fetcher` passed in is the same authenticated `api()` helper
 *   `useFoliate`'s `makeFoliateFetchFile` uses for its own Range requests, so every Range request
 *   this path makes carries the same `Authorization` header. No book byte-size is known ahead of
 *   time from `/api/v1/epub/:bookId/info`, so `openRemote`'s optional `size` is omitted; Reactor
 *   does one small Range probe request instead.
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
 * - Kobo/KOReader progress-sync fields (W1-B3, R-G2 "stays web-side"): `cfi`, `fraction`,
 *   `chapterTitle`, `location` (page count) come straight off Reactor's `relocate` event (the
 *   last is an opaque passthrough of foliate's own object, computed inside Reactor exactly as it
 *   is for the foliate path). `section` (chapter index/total), `time` (remaining reading time)
 *   and `koboContentSourceProgressPercent` are *not* in Reactor's v1 event, so this composable
 *   derives them web-side from `fraction` plus `host.core.getOpenBook()?.sections` (same
 *   `size`/`linear` fields and the same `SIZE_PER_LOCATION`/`SIZE_PER_TIME_UNIT` math foliate's
 *   own `src/vendor/foliate/progress.js` uses) via `../lib/reactor-section-progress.ts`.
 *   `koboLocationSource` (the spine item id) is derived the same way foliate derives it:
 *   `sections[index]?.id`. `koboLocationType`/`koboLocationValue` come from Reactor's
 *   `getKoboLocation()`, which reads the same `.koboSpan` lookup foliate's `view.js` does.
 *   `koreaderProgress` stays `null` on
 *   both paths: foliate's own `view.js` always sends `null` for it too (its CFI is converted on
 *   the server, where the original XHTML is available) - there is nothing to port here.
 * - Tap zones (W1-B4): the centre-only heuristic is replaced by Reactor's own canonical model,
 *   `shell.resolveTapZone` (`src/shell/zones.ts`) - left/right 30% bands (mirrored under RTL,
 *   `loaded.isRtl`) turn the page, the middle 40% calls `onMiddleTap`. Reactor's own `tap` event
 *   already reports `x`/`y` as viewport fractions (0-1), matching `resolveTapZone`'s input
 *   directly - no container-relative conversion needed, unlike foliate's postMessage-based zone
 *   math (`useFoliateInput`'s `handleWindowMessage`), which exists only to cross the iframe
 *   boundary Reactor's closed shadow root does not expose in the first place. Swipe gestures,
 *   `useFoliateInput`'s double-tap-same-zone debounce and its "mobile taps always toggle chrome"
 *   heuristic have no equivalent here: Reactor's own `src/core/selection.ts` already distinguishes
 *   a tap from a text selection and from a tap-on-an-existing-annotation at the DOM level, so the
 *   `tap` event this composable receives is only ever a genuine single tap.
 * - `getSectionFractions`, `getLocationContext`'s fraction lookup, and `getCFI`-based selection
 *   resolution have no Reactor equivalent exposed on `WebHost`; `getSectionFractions` is derived
 *   from `host.core.getOpenBook()?.sections` (same as the relocate fields above), the other two
 *   degrade to `null` (no Reactor equivalent of `resolveNavigation`/`getTOCItemOf` for a
 *   *non-current* target - these back the TTS resume-position lookup, out of scope per R-G4).
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
  canNavigate?: () => boolean,
) {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const fraction = ref(0)
  const viewRef = ref<unknown>(null)
  const bookLanguage = ref<string>('en')
  const isFixedLayout = ref(false)
  const hasMediaOverlay = ref(false)
  const isRtl = ref(false)

  let host: WebHost | null = null
  let unsubscribe: (() => void) | null = null
  let toc: unknown[] = []
  let onAnnotationClick: ((cfi: string, popupPosition: { x: number; y: number; showBelow: boolean }) => void) | null = null
  let onTextSelected: ((detail: SelectionDetail) => void) | null = null
  const annotationStyles = new Map<string, { color: string; style: string }>()
  // Debounce state for the tap-zone model (mirrors `useFoliateInput`'s own `isNavigating` and
  // `suppressClickNavigationUntil`).
  let isNavigatingTap = false
  let suppressTapNavigationUntil = 0

  function suppressNextTapNavigation() {
    suppressTapNavigationUntil = Date.now() + ANNOTATION_TAP_SUPPRESSION_MS
  }

  function isTapNavigationSuppressed() {
    return Date.now() < suppressTapNavigationUntil
  }

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

  function sectionsOf(): ReactorSectionLike[] {
    const book = host?.core.getOpenBook() as { sections?: ReactorSectionLike[] } | null
    return book?.sections ?? []
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
          isRtl.value = event.isRtl
          clearTimeout(loadTimeoutId)
          onApplyStyles?.(rendererShim)
          if (el.firstElementChild) onChapterLoad?.(el.ownerDocument, el.firstElementChild as HTMLElement)
          break
        }
        case 'relocate': {
          fraction.value = event.fraction ?? 0
          const derived = deriveSectionProgress(sectionsOf(), event.fraction ?? 0)
          const sections = sectionsOf()
          const koboLocationSource = derived ? (sections[derived.section.current]?.id ?? null) : null
          const kobo = host?.getKoboLocation() ?? null
          onRelocate?.({
            reason: event.reason ?? undefined,
            restoring: event.restoring,
            cfi: event.cfi,
            fraction: event.fraction ?? undefined,
            tocItem: event.chapterTitle ? { label: event.chapterTitle } : undefined,
            location: (event.location ?? derived?.location) as RelocateDetail['location'],
            section: derived?.section,
            time: derived?.time,
            source: koboLocationSource,
            koboLocationType: kobo?.type ?? null,
            koboLocationValue: kobo?.value ?? null,
            contentSourceProgressPercent: derived?.contentSourceProgressPercent ?? undefined,
            // Matches foliate's own `view.js`: the CFI is converted to a KOReader xpointer on
            // the server, where the original XHTML is available - the client never computes it.
            koreaderProgress: null,
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
          suppressNextTapNavigation()
          const rect = event.rect
          const x = rect ? Math.max(100, Math.min((rect.left + rect.right) / 2, window.innerWidth - 150)) : window.innerWidth / 2
          const showBelow = rect ? rect.top < 120 : false
          const y = rect ? (showBelow ? rect.bottom + 10 : rect.top - 50) : 100
          onAnnotationClick(event.cfi, { x, y, showBelow })
          break
        }
        case 'tap': {
          // W1-B4: Reactor's own canonical tap-zone model (`src/shell/zones.ts`), not a
          // container-relative centre heuristic. `event.x` is already a viewport fraction
          // (0-1), exactly what `resolveTapZone` expects.
          if (isTapNavigationSuppressed()) break
          const zone = shell.resolveTapZone(event.x, isRtl.value)
          if (zone === 'toggle') {
            onMiddleTap?.()
          } else if (!isNavigatingTap && (canNavigate?.() ?? true)) {
            isNavigatingTap = true
            host?.dispatch({ type: zone })
            setTimeout(() => {
              isNavigatingTap = false
            }, NAVIGATION_DEBOUNCE_MS)
          }
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

      const fetcher: typeof fetch = (input, init) => api(input, init)
      await host.openRemote({ format, cfi: null, fraction: null, settings: null, previousCfi: null }, `/api/v1/books/files/${fileId}/serve`, fetcher)

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
    getSectionFractions: (): number[] => deriveSectionFractions(sectionsOf()),
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
