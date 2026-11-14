import type { ContentCore } from '../../core/content-core.js';
export interface GlossaryPopoverOptions {
    /** The inline popover's own "Go to glossary" icon button (SHELL.md U4 row). */
    onOpenInGlossary(term: string): void;
}
export interface GlossaryPopoverHandle {
    /** True while the popover is visible (U9: lets mount.ts's Escape router close this layer
     * before falling through to the sidebars/bars, instead of this module's own listener). */
    isOpen(): boolean;
    close(): void;
    destroy(): void;
}
export declare function mountGlossaryPopover(shellRoot: HTMLElement, core: ContentCore, options: GlossaryPopoverOptions): GlossaryPopoverHandle;
