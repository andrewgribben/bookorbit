export type TkSyncItemKind = 'annotation' | 'journal' | 'finished';

interface TkSyncItemBase {
  sourceKey: string;
  dateKey: string;
  occurredAt: Date;
  bookId: number;
  bookTitle: string;
  bookAuthor: string;
  url: string;
}

export interface TkAnnotationItem extends TkSyncItemBase {
  kind: 'annotation';
  text: string;
  note: string | null;
}

export interface TkJournalItem extends TkSyncItemBase {
  kind: 'journal';
  body: string;
  quote: string | null;
}

export interface TkFinishedItem extends TkSyncItemBase {
  kind: 'finished';
  rating: number | null;
}

export type TkSyncItem = TkAnnotationItem | TkJournalItem | TkFinishedItem;

/** Minimal Tiptap JSON shapes this module needs to read (not an exhaustive Tiptap type). */
export interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown> & { id?: string };
  marks?: TiptapMark[];
  text?: string;
  content?: TiptapNode[];
}

export interface TkDailyNoteDoc {
  type: string;
  content?: TiptapNode[];
}
