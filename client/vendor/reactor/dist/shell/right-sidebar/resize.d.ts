import type { SizeClass } from '../types.js';
export declare const DEFAULT_WIDTH: Record<Exclude<SizeClass, 'phone'>, number>;
export declare const MIN_WIDTH = 240;
export declare const KEYBOARD_RESIZE_STEP = 16;
/** Clamps a candidate sidebar width to [MIN_WIDTH, the size class's max fraction of
 * `containerWidth`]. Phone never docks/resizes (it's always an overlay at a fixed geometry), so
 * callers should not invoke this for the phone size class. */
export declare function clampWidth(width: number, containerWidth: number, sizeClass: Exclude<SizeClass, 'phone'>): number;
