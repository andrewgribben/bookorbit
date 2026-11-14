import type { ReaderSettings } from '../../protocol/v1/settings.js';
import type { HostChannel } from '../../host-api/channel.js';
import type { SizeClass } from '../types.js';
export type SettingsScope = 'global' | 'book';
export type SettingsTab = 'typography' | 'layout' | 'theme' | 'controls' | 'playback';
export interface SettingsPanelOptions {
    /** Current size class, read fresh on every open since a rotation can happen between calls
     * (same pattern as RightSidebarOptions.getSizeClass). Decides bottom-sheet vs docked panel
     * presentation (SHELL.md U6 row). */
    getSizeClass(): SizeClass;
    /** E-ink mode: no animation, square corners, no translucency (SHELL.md section 1). */
    eink?: boolean;
    /** Protocol v2 boundary (src/host-api): receives `setSettingsScope` and `configure` commands,
     * emits `settingsChange` intents. Optional - a host that never sends `configure` sees no v2
     * traffic at all (WORKTREE_BRIEF.md rule 1), and the panel still fully works locally against
     * ContentCore.applyStyles with no host wired in at all (e.g. a bare harness). */
    hostChannel?: HostChannel;
    /** True only if the host has declared the `volumeKeys` capability some other way (protocol
     * v2's `ConfigureCapabilities` has no field for this yet - see the comment on the Controls tab
     * in mount.ts). Defaults to hidden/false so no control appears without an explicit flag. */
    volumeKeysCapability?: boolean;
    /** Called whenever the panel opens or closes, so mount.ts can keep its own ChromeState and
     * sidebar-mutual-exclusion logic in sync (mirrors U2/U3's onSidebarChange/onClose). */
    onOpenChange?: (open: boolean) => void;
}
export interface SettingsPanelHandle {
    open(): void;
    close(): void;
    toggle(): void;
    isOpen(): boolean;
    /** The settings object currently being edited/applied for the active scope tab. Exposed for
     * tests and for a host adapter that wants the latest value without its own round trip. */
    getActiveSettings(): ReaderSettings;
    getActiveScope(): SettingsScope;
    destroy(): void;
}
