import type { NarrationTimelineItem } from '../../protocol/v1/events.js';
export interface NarrationTimelineLike {
    items: NarrationTimelineItem[];
}
export declare class NarrationFollow {
    private timeline;
    private activeAudioIndex;
    setTimeline(timeline: NarrationTimelineLike | null): void;
    clear(): void;
    hasTimeline(): boolean;
    /** The narrated item whose `[beginSec, endSec)` window contains `positionSec`, or null if the
     * position falls outside every item (silence, credits, before/after the narrated audio). */
    itemFor(positionSec: number): NarrationTimelineItem | null;
    textHrefFor(positionSec: number): string | null;
}
