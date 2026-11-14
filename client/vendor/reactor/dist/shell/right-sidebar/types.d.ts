import type { HostChannel } from '../../host-api/index.js';
import type { SizeClass } from '../types.js';
/** Tabs whose presence is capability-gated (SHELL.md fix #7 / §7 Q2). Glossary differs from
 * Related/Starred/Notes: it is derived from the book itself (SPEC.md D7), not host-supplied
 * data, so it defaults to present unless a host explicitly turns it off via protocol v2's
 * `configure{capabilities.glossary}` (src/protocol/v2/commands.ts) - U8 owns wiring the real
 * transport onto this option; until then a caller passes it directly, same as U2 did for
 * `related` in src/shell/left-sidebar/types.ts. */
export interface RightSidebarCapabilities {
    glossary?: boolean;
}
export interface RightSidebarOptions {
    /** Current size class, read fresh on every open/resize so a rotation between calls is seen. */
    getSizeClass(): SizeClass;
    capabilities?: RightSidebarCapabilities;
    /** Called whenever the docked width settles after a drag or a keyboard resize (SHELL.md U3
     * §7 Q3: persisted by the host, not by Reactor itself). Stands in for protocol v2's
     * `settingsChange` until U8 lands - see docs/design/SHELL.md section 7 Q3. */
    onWidthChange?: (width: number) => void;
    /** Called when the phone overlay closes itself (close button, open-in-main on phone). The
     * caller (mount.ts) uses this to keep its own ChromeState in sync. */
    onClose?: () => void;
    /** Present only when the host has opted into protocol v2 (U8). The Notes tab (U5) stays
     * disabled, same as the inert Glossary tab, when this is absent. */
    hostChannel?: HostChannel;
}
export interface RightSidebarHandle {
    open(): void;
    close(): void;
    toggle(): void;
    isOpen(): boolean;
    destroy(): void;
    /** Re-applies the book-column inset for the current size class (src/shell/layout.ts). Call
     * this after a viewport resize crosses the phone <-> docked breakpoint while the panel is
     * open; mount.ts's own resize handling is the only caller today. */
    refreshLayout(): void;
    /** Opens the panel (if closed), switches to the Glossary tab and scrolls to/flashes `term`.
     * Used by the inline glossary popover's "Go to glossary" button (src/shell/glossary/). */
    openGlossaryTerm(term: string): void;
}
