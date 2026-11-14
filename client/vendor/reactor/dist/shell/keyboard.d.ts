export type KeyboardAction = 'prev' | 'next' | 'toggleBars' | 'escape';
/** Resolves a keydown to the shell action it performs, or null when the key isn't one of the
 * shell's bindings (the caller should let it fall through to the browser's default handling). */
export declare function resolveKeyboardAction(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>): KeyboardAction | null;
/** Keys the shell handles and must preventDefault for (space scrolling the page, arrows moving
 * focus) so the browser's own scroll/focus behaviour doesn't fight the reader's own paging. */
export declare function isPreventableKey(action: KeyboardAction | null): boolean;
