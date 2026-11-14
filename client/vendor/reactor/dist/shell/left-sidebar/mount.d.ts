import type { LeftSidebarHandle, LeftSidebarOptions } from './types.js';
/** `container` is the shell root (same element U1's buildShellDom works on); `goTo` is
 * ContentCore's own navigation entry point, passed in rather than the whole core so this module
 * can never reach for anything beyond that one call (mirrors the host-neutral boundary a native
 * chrome would also sit behind). */
export declare function mountLeftSidebar(container: HTMLElement, goTo: (target: string) => void, options?: LeftSidebarOptions): LeftSidebarHandle;
