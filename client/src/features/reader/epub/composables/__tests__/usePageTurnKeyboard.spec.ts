import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPageTurnKeydownHandler } from '../usePageTurnKeyboard'

function dispatchKeydown(target: EventTarget, init: KeyboardEventInit) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
}

describe('createPageTurnKeydownHandler', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('maps ArrowLeft/ArrowRight/PageUp/PageDown/Space/Shift+Space to the given navigation callbacks', () => {
    const nav = {
      left: vi.fn<() => void>(),
      right: vi.fn<() => void>(),
      prev: vi.fn<() => void>(),
      next: vi.fn<() => void>(),
    }
    const handler = createPageTurnKeydownHandler(nav)
    document.addEventListener('keydown', handler)

    dispatchKeydown(document, { key: 'ArrowLeft' })
    dispatchKeydown(document, { key: 'ArrowRight' })
    dispatchKeydown(document, { key: 'PageUp' })
    dispatchKeydown(document, { key: 'PageDown' })
    dispatchKeydown(document, { key: ' ' })
    dispatchKeydown(document, { key: ' ', shiftKey: true })

    expect(nav.left).toHaveBeenCalledTimes(1)
    expect(nav.right).toHaveBeenCalledTimes(1)
    expect(nav.prev).toHaveBeenCalledTimes(2) // PageUp, then Shift+Space
    expect(nav.next).toHaveBeenCalledTimes(2) // PageDown, then Space

    document.removeEventListener('keydown', handler)
  })

  it('ignores keys while the focused target is an input or textarea (typing targets)', () => {
    // `isContentEditable` is not implemented by jsdom (always undefined), so the
    // contenteditable branch of `isTypingTarget` cannot be exercised in this test
    // environment; it is covered by code review and matches foliate's own check.
    const nav = { left: vi.fn<() => void>(), right: vi.fn<() => void>(), prev: vi.fn<() => void>(), next: vi.fn<() => void>() }
    const handler = createPageTurnKeydownHandler(nav)
    document.addEventListener('keydown', handler)

    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    document.body.append(input, textarea)

    dispatchKeydown(input, { key: 'ArrowLeft' })
    dispatchKeydown(textarea, { key: 'ArrowRight' })

    expect(nav.left).not.toHaveBeenCalled()
    expect(nav.right).not.toHaveBeenCalled()

    document.removeEventListener('keydown', handler)
  })

  it('ignores the key when a modifier (ctrl/meta/alt) is held, so OS/browser shortcuts still work', () => {
    const nav = { left: vi.fn<() => void>(), right: vi.fn<() => void>(), prev: vi.fn<() => void>(), next: vi.fn<() => void>() }
    const handler = createPageTurnKeydownHandler(nav)
    document.addEventListener('keydown', handler)

    dispatchKeydown(document, { key: 'ArrowLeft', metaKey: true })
    dispatchKeydown(document, { key: 'ArrowLeft', ctrlKey: true })
    dispatchKeydown(document, { key: 'ArrowLeft', altKey: true })

    expect(nav.left).not.toHaveBeenCalled()

    document.removeEventListener('keydown', handler)
  })

  it('calls canNavigate before acting and blocks navigation when it returns false', () => {
    const nav = { left: vi.fn<() => void>(), right: vi.fn<() => void>(), prev: vi.fn<() => void>(), next: vi.fn<() => void>() }
    const canNavigate = vi.fn<() => boolean>().mockReturnValue(false)
    const handler = createPageTurnKeydownHandler(nav, canNavigate)
    document.addEventListener('keydown', handler)

    dispatchKeydown(document, { key: 'ArrowRight' })

    expect(canNavigate).toHaveBeenCalledTimes(1)
    expect(nav.right).not.toHaveBeenCalled()

    document.removeEventListener('keydown', handler)
  })

  it('preventDefault()s a handled key even when canNavigate blocks it, so the page does not also scroll', () => {
    const nav = { left: vi.fn<() => void>(), right: vi.fn<() => void>(), prev: vi.fn<() => void>(), next: vi.fn<() => void>() }
    const handler = createPageTurnKeydownHandler(nav, () => false)
    document.addEventListener('keydown', handler)

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
    document.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)

    document.removeEventListener('keydown', handler)
  })

  it('ignores unrelated keys', () => {
    const nav = { left: vi.fn<() => void>(), right: vi.fn<() => void>(), prev: vi.fn<() => void>(), next: vi.fn<() => void>() }
    const handler = createPageTurnKeydownHandler(nav)
    document.addEventListener('keydown', handler)

    dispatchKeydown(document, { key: 'a' })
    dispatchKeydown(document, { key: 'Enter' })

    expect(nav.left).not.toHaveBeenCalled()
    expect(nav.right).not.toHaveBeenCalled()
    expect(nav.prev).not.toHaveBeenCalled()
    expect(nav.next).not.toHaveBeenCalled()

    document.removeEventListener('keydown', handler)
  })
})
