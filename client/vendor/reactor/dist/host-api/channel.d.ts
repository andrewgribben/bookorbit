import type { ReaderCommandV2 } from '../protocol/v2/commands.js';
import type { ReaderIntentV2 } from '../protocol/v2/intents.js';
type CommandListener = (command: ReaderCommandV2) => void;
type IntentListener = (intent: ReaderIntentV2) => void;
type ConfigureCommandV2 = Extract<ReaderCommandV2, {
    type: 'configure';
}>;
type SetNotesCommandV2 = Extract<ReaderCommandV2, {
    type: 'setNotes';
}>;
export interface HostChannel {
    /** Feeds one parsed, already-validated v2 command in (host -> Reactor direction). Notifies
     * every `onCommand` listener; a `configure` also flips `isV2Enabled()` on for good (a host
     * does not un-opt-in mid-session).
     *
     * Capability presence is decided once, from the first `configure` only (protocol v2 README
     * "Decided questions": a later `set*` call - or a later `configure` - is a data update, never
     * a presence toggle). So a second-or-later `configure` only ever updates `chrome`, `eink` and
     * `insets`; its `capabilities` and `locale` fields are ignored and the channel re-stamps the
     * first configure's values onto both the stored config and the command every listener
     * receives, so no shell component needs to re-implement this rule itself. */
    dispatch(command: ReaderCommandV2): void;
    /** Subscribes to every v2 command the host sends; returns an unsubscribe function. */
    onCommand(listener: CommandListener): () => void;
    /** Emits one intent toward the host (Reactor -> host direction). Silently dropped - never
     * queued, never retried - until the host has opted in with `configure`: WORKTREE_BRIEF.md
     * rule 1 requires a v1-only host to see zero v2 traffic, including intents it never asked
     * for, so the gate lives here once rather than in every call site that might emit one. */
    emitIntent(intent: ReaderIntentV2): void;
    /** Subscribes to every intent the shell emits; a host adapter serialises these to the wire.
     * Listeners are only ever invoked after the host has opted in - see `emitIntent`. */
    onIntent(listener: IntentListener): () => void;
    /** True once the host has sent `configure` at least once this session. */
    isV2Enabled(): boolean;
    /** The most recent `configure` payload, or null before the host ever opts in. */
    getConfig(): ConfigureCommandV2 | null;
    /** The most recently received notes window, or null before the first one arrives. Only the
     * latest window is ever kept - a new one replaces the last, never appends to it - so a 5,000-
     * note book never materialises as a 5,000-item array here (WORKTREE_BRIEF.md rule 5). Ask for
     * another window with a `notesPageRequest` intent. */
    getNotesWindow(): SetNotesCommandV2 | null;
}
export declare function createHostChannel(): HostChannel;
export {};
