export type TapZoneAction = 'prev' | 'next' | 'toggle';
/** Left/right zones are >=30% of the column width each (SHELL.md U1 row); the remaining centre
 * band toggles the bars, same as a generic tap. */
export declare const ZONE_FRACTION = 0.3;
/** Resolves a tap's x fraction (0-1) to the action its zone performs. In a right-to-left book
 * (`loaded.isRtl`), the physical left zone turns the page forward and the right zone turns it
 * back, mirroring the reading direction (SHELL.md U1 row: "incl. RTL mirroring"). */
export declare function resolveTapZone(xFraction: number, isRtl: boolean): TapZoneAction;
