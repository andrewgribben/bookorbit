import type { HostChannel } from '../host-api/index.js';
export type SizeClass = 'phone' | 'fold-tablet' | 'desktop';
export type SidebarState = 'none' | 'left' | 'right';
/** Mirrors protocol v2's draft `chromeState` intent (DRAFT.md), emitted locally for now since
 * U8 owns wiring this onto a real transport. A host (or a later U8 pass) subscribes via
 * `ShellHandle.onChromeState`. */
export interface ChromeState {
    barsVisible: boolean;
    sidebar: SidebarState;
}
export interface ShellOptions {
    /** Forces e-ink mode: no animation, no translucency, square corners (SHELL.md section 1). */
    eink?: boolean;
    /** 'host' keeps the host's own native chrome and mounts no shell DOM (SPEC.md D4 stage 1).
     * 'reactor' draws the full shell. Defaults to 'reactor'. */
    chrome?: 'host' | 'reactor';
    /** Called whenever the right sidebar's docked width settles after a resize (SHELL.md U3 §7
     * Q3). Stands in for protocol v2's `settingsChange{scope:"ui", settings:{ctxWidth}}` until
     * U8 lands. */
    onContextWidthChange?: (width: number) => void;
    /** Present only when the host has opted into protocol v2 (U8). Enables the bookmark button,
     * the Notes tab and the selection/mark-edit annotation UI (U5), the Glossary tab (U4), U6's
     * settings panel (receives `setSettingsScope`/`configure`, emits `settingsChange`), and U7's
     * playback bar (mounts and shows itself once the host's `configure` declares
     * `capabilities.playback`); absent, those stay the same inert placeholders earlier U tasks
     * shipped. A host that never sends `configure` sees no v2 traffic (WORKTREE_BRIEF.md rule 1). */
    hostChannel?: HostChannel;
    /** Shown as a Controls-tab toggle only when true (SHELL.md U6 row: "volume keys flag if host
     * capability"); protocol v2's `capabilities` object has no field for this yet. */
    volumeKeysCapability?: boolean;
}
export interface ShellHandle {
    /** Current chrome state (bars + sidebar visibility). */
    getChromeState(): ChromeState;
    /** Subscribes to chrome state changes; returns an unsubscribe function. */
    onChromeState(listener: (state: ChromeState) => void): () => void;
    /** Shows/hides the top and bottom bars programmatically (e.g. a host wants bars hidden on
     * entry). Equivalent to what a tap toggle does. */
    setBarsVisible(visible: boolean): void;
    /** Recomputes the size class from the container's current width and re-applies its class. */
    refreshSizeClass(): void;
    /** Tears down every listener the shell attached and removes its DOM. */
    destroy(): void;
}
