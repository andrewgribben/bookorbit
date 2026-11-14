import type { HostChannel } from '../../host-api/index.js';
import type { ContentCore } from '../../core/content-core.js';
export interface AnnotationUiOptions {
    /** Forces e-ink-safe popover styling (no translucency/elevation - SHELL.md section 1.3). */
    eink?: boolean;
}
export interface AnnotationUiHandle {
    /** True while the create/edit popover is visible (U9: lets mount.ts's Escape router close
     * this layer before falling through to the sidebars/bars). */
    isOpen(): boolean;
    /** Closes the popover without committing any pending change, same as its own close button. */
    close(): void;
    destroy(): void;
}
export interface MountAnnotationUiArgs {
    shellRoot: HTMLElement;
    core: ContentCore;
    hostChannel: HostChannel;
    options?: AnnotationUiOptions;
}
