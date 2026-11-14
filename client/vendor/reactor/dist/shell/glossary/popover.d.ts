import type { ContentCore } from '../../core/content-core.js';
export interface GlossaryPopoverOptions {
    /** The inline popover's own "Go to glossary" icon button (SHELL.md U4 row). */
    onOpenInGlossary(term: string): void;
}
export interface GlossaryPopoverHandle {
    destroy(): void;
}
export declare function mountGlossaryPopover(shellRoot: HTMLElement, core: ContentCore, options: GlossaryPopoverOptions): GlossaryPopoverHandle;
