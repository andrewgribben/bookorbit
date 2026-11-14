import type { ReaderSettings } from '../protocol/v1/settings.js';
import { DEFAULT_ACTIVE_CLASS } from './narration.js';
export interface ThemeColors {
    fg: string;
    bg: string;
    link: string;
}
export interface Theme {
    name: string;
    light: ThemeColors;
    dark: ThemeColors;
}
export declare const THEMES: Theme[];
export declare const DEFAULT_SETTINGS: ReaderSettings;
/** Merges a possibly-partial settings payload over the current (or default) settings, the same
 * way bridge.js's `applyStyles` does: `{ ...DEFAULT_SETTINGS, ...(settings ?? current ?? {}) }`. */
export declare function mergeSettings(settings: Partial<ReaderSettings> | null | undefined, current: ReaderSettings | null): ReaderSettings;
export declare function themeFor(name: string): Theme;
export declare function themeCSS(s: ReaderSettings, narrationActiveClass: string | null): string;
export declare function overrideCSS(s: ReaderSettings): string;
export declare function fontSizeCSS(s: ReaderSettings): string;
export declare function generateCSS(s: ReaderSettings, narrationActiveClass: string | null): string;
export { DEFAULT_ACTIVE_CLASS };
