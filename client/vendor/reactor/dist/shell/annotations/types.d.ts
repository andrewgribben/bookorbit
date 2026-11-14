import type { HostChannel } from '../../host-api/index.js';
import type { ContentCore } from '../../core/content-core.js';
export interface AnnotationUiOptions {
    /** Forces e-ink-safe popover styling (no translucency/elevation - SHELL.md section 1.3). */
    eink?: boolean;
}
export interface AnnotationUiHandle {
    destroy(): void;
}
export interface MountAnnotationUiArgs {
    shellRoot: HTMLElement;
    core: ContentCore;
    hostChannel: HostChannel;
    options?: AnnotationUiOptions;
}
