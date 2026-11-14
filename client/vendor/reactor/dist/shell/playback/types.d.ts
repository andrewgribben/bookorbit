export interface PlaybackBarOptions {
    /** E-ink mode: no animation, no translucency (SHELL.md section 1). */
    eink?: boolean;
}
export interface PlaybackBarHandle {
    /** True once the host's `configure{capabilities.playback}` has been seen as `true` - the bar
     * never appears without it and never disappears once shown (capability is decided once at
     * the first `configure`, per SHELL.md section 7 Q2). */
    isVisible(): boolean;
    destroy(): void;
}
