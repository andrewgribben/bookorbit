import type { FoliateHistory, FoliateLastLocation } from './foliate-types.js';
export interface UndoTarget {
    lastLocation?: FoliateLastLocation;
    history: FoliateHistory;
}
/** Opening jumped to a synced position: record [this device's last position, synced position]
 * so Undo returns to where this device was. Skipped when the old position is on the page now
 * shown - Undo would go nowhere. */
export declare function offerUndoTo(view: UndoTarget, previousCfi: string, openedCfi: string): void;
