import type { ReaderSettings } from '../../protocol/v1/settings.js';
export declare const DEFAULT_SETTINGS: ReaderSettings;
/** One Theme tab swatch (SHELL.md U6 row: "incl. amoled and e-ink"). `isDark`/`themeName`
 * together select one of core/styles.ts's THEMES; the swatch list here is the curated subset
 * the Theme tab exposes, not the full THEMES catalogue (gray/crimson/meadow/... stay available
 * to a host that sets them directly via `setSettingsScope`, just not offered as a swatch here -
 * SHELL.md section 3 U6 row only asks for Light/Sepia/Dark, plus this task's amoled addition). */
export interface ThemeSwatch {
    id: string;
    label: string;
    themeName: string;
    isDark: boolean;
    swatchBg: string;
    swatchFg: string;
}
export declare const THEME_SWATCHES: ThemeSwatch[];
export declare function swatchFor(themeName: string, isDark: boolean): ThemeSwatch;
/** Typography tab's typeface pills. `null` means "use the book/publisher's own font" - the
 * same meaning `ReaderSettings.fontFamily: null` already carries (core/styles.ts's
 * `overrideCSS` only emits a font-family rule when it is non-null). */
export interface FontFamilyOption {
    id: string;
    label: string;
    value: string | null;
}
export declare const FONT_FAMILY_OPTIONS: FontFamilyOption[];
