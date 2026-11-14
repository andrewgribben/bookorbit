import { type MarkStyleId } from './dom.js';
import type { AnnotationUiHandle, MountAnnotationUiArgs } from './types.js';
/** The only two `kind`s protocol v2 defines for a text-anchored mark; strikethrough/squiggly are
 * drawn as `style` variants of one of them (src/marks/draw.ts already draws all four styles
 * regardless of `kind` - `kind` only drives the Notes tab's type filter, SHELL.md U5 row). */
export declare function markKindForStyle(style: MarkStyleId): 'highlight' | 'underline';
export declare function mountAnnotationUi({ shellRoot, core, hostChannel, options }: MountAnnotationUiArgs): AnnotationUiHandle;
