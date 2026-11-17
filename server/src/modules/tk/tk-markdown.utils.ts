import { TK_ITEM_MAX_CHARS, TK_SECTION_HEADING } from './tk.constants';
import type { TkAnnotationItem, TkFinishedItem, TkJournalItem, TkSyncItem } from './tk.types';

/**
 * Escapes leading Markdown structure characters (heading `#`, blockquote `>`, list `-`) at the
 * start of a line, so user text cannot change the block structure of the rendered note. Markdown
 * emphasis/inline syntax elsewhere in the text is left alone deliberately.
 */
export function escapeMarkdownStructure(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^(\s*)([#>-])/, '$1\\$2'))
    .join('\n');
}

export function truncateItemText(text: string, maxChars = TK_ITEM_MAX_CHARS): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}...`;
}

function renderBookLink(title: string, author: string, url: string): string {
  const label = author ? `${title}, ${author}` : title;
  return `[${label}](${url})`;
}

export function renderAnnotationItem(item: TkAnnotationItem): string {
  const lines = [`> ${truncateItemText(escapeMarkdownStructure(item.text))}`];
  if (item.note) lines.push(`- Note: ${truncateItemText(escapeMarkdownStructure(item.note))}`);
  lines.push(renderBookLink(item.bookTitle, item.bookAuthor, item.url));
  return lines.join('\n\n');
}

export function renderJournalItem(item: TkJournalItem): string {
  const lines = [truncateItemText(escapeMarkdownStructure(item.body))];
  if (item.quote) lines.push(`> ${truncateItemText(escapeMarkdownStructure(item.quote))}`);
  lines.push(renderBookLink(item.bookTitle, item.bookAuthor, item.url));
  return lines.join('\n\n');
}

export function renderFinishedItem(item: TkFinishedItem): string {
  const lines = [`Finished [${item.bookTitle}](${item.url}) by ${item.bookAuthor}.`];
  if (item.rating != null) lines.push(`Rating: ${item.rating}/5`);
  return lines.join('\n\n');
}

export function renderSyncItem(item: TkSyncItem): string {
  switch (item.kind) {
    case 'annotation':
      return renderAnnotationItem(item);
    case 'journal':
      return renderJournalItem(item);
    case 'finished':
      return renderFinishedItem(item);
  }
}

/**
 * Renders the Markdown block for one day's worth of items, in time order. `includeHeading`
 * controls whether the `## BookOrbit` section heading is added: only the first block written to
 * a given day's note should include it (see tk-tiptap.utils for anchor/heading detection on an
 * existing note).
 */
export function renderDayBlock(items: readonly TkSyncItem[], includeHeading: boolean): string {
  const body = items.map((item) => renderSyncItem(item)).join('\n\n');
  return includeHeading ? `## ${TK_SECTION_HEADING}\n\n${body}` : body;
}
