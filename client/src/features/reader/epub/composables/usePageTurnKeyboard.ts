export interface PageTurnNavigation {
  /** Physical-left action (RTL-aware: `goLeft`/`prev` for the view currently on screen). */
  left: () => void
  /** Physical-right action (RTL-aware: `goRight`/`next` for the view currently on screen). */
  right: () => void
  /** Reading-order previous, independent of visual direction (PageUp/Shift+Space). */
  prev: () => void
  /** Reading-order next, independent of visual direction (PageDown/Space). */
  next: () => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

/**
 * Builds the ArrowLeft/ArrowRight/PageUp/PageDown/Space page-turn keydown handler shared by
 * `useFoliateInput` (foliate engine) and `useReactor` (Reactor engine), so both engines offer
 * identical keyboard page-turn semantics: ignore typing targets (input/textarea/contenteditable),
 * ignore modifier-key combos (so OS/browser shortcuts like Cmd+ArrowLeft keep working), and defer
 * to `canNavigate` before acting.
 */
export function createPageTurnKeydownHandler(nav: PageTurnNavigation, canNavigate?: () => boolean) {
  function canProceed(): boolean {
    return canNavigate ? canNavigate() : true
  }

  return function handlePageTurnKeydown(e: KeyboardEvent) {
    const target = (e.composedPath?.()[0] ?? e.target) as EventTarget | null
    if (isTypingTarget(target)) return
    if (e.ctrlKey || e.metaKey || e.altKey) return

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (!canProceed()) return
      nav.left()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (!canProceed()) return
      nav.right()
    } else if (e.key === 'PageUp') {
      e.preventDefault()
      if (!canProceed()) return
      nav.prev()
    } else if (e.key === 'PageDown') {
      e.preventDefault()
      if (!canProceed()) return
      nav.next()
    } else if (e.key === ' ' && e.shiftKey) {
      e.preventDefault()
      if (!canProceed()) return
      nav.prev()
    } else if (e.key === ' ') {
      e.preventDefault()
      if (!canProceed()) return
      nav.next()
    }
  }
}
