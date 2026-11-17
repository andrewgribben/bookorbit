import { TK_SECTION_HEADING } from './tk.constants';
import type { TiptapNode, TkDailyNoteDoc } from './tk.types';

function headingText(node: TiptapNode): string {
  if (!node.content) return '';
  return node.content
    .filter((child) => child.type === 'text')
    .map((child) => child.text ?? '')
    .join('');
}

function* walk(node: TiptapNode): Iterable<TiptapNode> {
  yield node;
  for (const child of node.content ?? []) yield* walk(child);
}

/**
 * True when `url` already appears as a link mark's `href` anywhere in the note's Tiptap JSON.
 * Used to drop items already written on a retry after a crash between the TK write and the
 * ledger insert (see docs/TK_DAILY_NOTES_SYNC.md "Flush").
 */
export function noteContainsLinkTo(doc: TkDailyNoteDoc, url: string): boolean {
  for (const node of doc.content ?? []) {
    for (const descendant of walk(node)) {
      for (const mark of descendant.marks ?? []) {
        if (mark.type === 'link' && mark.attrs?.href === url) return true;
      }
    }
  }
  return false;
}

export interface TkAnchor {
  /** Node id to anchor an `insert_sibling_node` op on, or null when the note has no top-level nodes. */
  anchorNodeId: string | null;
  /** True when the first write to this day must add the `## BookOrbit` heading itself. */
  needsHeading: boolean;
}

/**
 * Picks the anchor for the next `insert_sibling_node` op: the last node of the existing
 * `## BookOrbit` section when present, otherwise the last top-level node of the note (and the
 * write must then add its own heading).
 */
export function findTkAnchor(doc: TkDailyNoteDoc): TkAnchor {
  const topLevel = doc.content ?? [];
  if (topLevel.length === 0) return { anchorNodeId: null, needsHeading: true };

  const headingIndex = topLevel.findIndex(
    (node) => node.type === 'heading' && node.attrs?.level === 2 && headingText(node).trim() === TK_SECTION_HEADING,
  );
  if (headingIndex === -1) {
    const last = topLevel[topLevel.length - 1];
    return { anchorNodeId: last.attrs?.id ?? null, needsHeading: true };
  }

  let lastInSection = topLevel[headingIndex];
  for (let i = headingIndex + 1; i < topLevel.length; i += 1) {
    const node = topLevel[i];
    const isNewSection = node.type === 'heading' && typeof node.attrs?.level === 'number' && (node.attrs.level as number) <= 2;
    if (isNewSection) break;
    lastInSection = node;
  }
  return { anchorNodeId: lastInSection.attrs?.id ?? null, needsHeading: false };
}
