import { describe, expect, it } from 'vitest';

import {
  escapeMarkdownStructure,
  renderAnnotationItem,
  renderDayBlock,
  renderFinishedItem,
  renderJournalItem,
  truncateItemText,
} from './tk-markdown.utils';
import type { TkAnnotationItem, TkFinishedItem, TkJournalItem } from './tk.types';

function annotation(overrides: Partial<TkAnnotationItem> = {}): TkAnnotationItem {
  return {
    kind: 'annotation',
    sourceKey: '1',
    dateKey: '2026-11-17',
    occurredAt: new Date('2026-11-17T10:00:00Z'),
    bookId: 7,
    bookTitle: 'Dune',
    bookAuthor: 'Frank Herbert',
    text: 'Fear is the mind-killer.',
    note: null,
    url: 'https://library.grib.co/book/7?tab=highlights&annotationId=1',
    ...overrides,
  };
}

describe('escapeMarkdownStructure', () => {
  it('escapes leading #, > and - at the start of a line', () => {
    expect(escapeMarkdownStructure('# not a heading')).toBe('\\# not a heading');
    expect(escapeMarkdownStructure('> not a quote')).toBe('\\> not a quote');
    expect(escapeMarkdownStructure('- not a list item')).toBe('\\- not a list item');
  });

  it('leaves text without leading structure characters untouched', () => {
    expect(escapeMarkdownStructure('a - b')).toBe('a - b');
    expect(escapeMarkdownStructure('plain text')).toBe('plain text');
  });

  it('escapes every line independently', () => {
    expect(escapeMarkdownStructure('# one\n- two')).toBe('\\# one\n\\- two');
  });
});

describe('truncateItemText', () => {
  it('leaves short text untouched', () => {
    expect(truncateItemText('hello', 10)).toBe('hello');
  });

  it('truncates at the character limit and marks it', () => {
    const result = truncateItemText('a'.repeat(20), 10);
    expect(result).toBe(`${'a'.repeat(10)}...`);
  });
});

describe('renderAnnotationItem', () => {
  it('renders a highlight-only item as a quote plus book link', () => {
    const rendered = renderAnnotationItem(annotation());
    expect(rendered).toBe('> Fear is the mind-killer.\n\n[Dune, Frank Herbert](https://library.grib.co/book/7?tab=highlights&annotationId=1)');
  });

  it('adds a Note line when the annotation has a note', () => {
    const rendered = renderAnnotationItem(annotation({ note: 'This stuck with me.' }));
    expect(rendered).toContain('- Note: This stuck with me.');
  });

  it('truncates a very long highlight at 8000 characters', () => {
    const rendered = renderAnnotationItem(annotation({ text: 'x'.repeat(9000) }));
    expect(rendered).toContain(`${'x'.repeat(8000)}...`);
  });
});

describe('renderJournalItem', () => {
  function journal(overrides: Partial<TkJournalItem> = {}): TkJournalItem {
    return {
      kind: 'journal',
      sourceKey: 'client-1',
      dateKey: '2026-11-17',
      occurredAt: new Date('2026-11-17T10:00:00Z'),
      bookId: 7,
      bookTitle: 'Dune',
      bookAuthor: 'Frank Herbert',
      body: 'Really enjoying the pacing.',
      quote: null,
      url: 'https://library.grib.co/book/7',
      ...overrides,
    };
  }

  it('renders body then book link when there is no quote', () => {
    const rendered = renderJournalItem(journal());
    expect(rendered).toBe('Really enjoying the pacing.\n\n[Dune, Frank Herbert](https://library.grib.co/book/7)');
  });

  it('renders the quote as a blockquote between body and link', () => {
    const rendered = renderJournalItem(journal({ quote: 'The spice must flow.' }));
    expect(rendered).toBe('Really enjoying the pacing.\n\n> The spice must flow.\n\n[Dune, Frank Herbert](https://library.grib.co/book/7)');
  });
});

describe('renderFinishedItem', () => {
  function finished(overrides: Partial<TkFinishedItem> = {}): TkFinishedItem {
    return {
      kind: 'finished',
      sourceKey: '7:2026-11-17T10:00:00.000Z',
      dateKey: '2026-11-17',
      occurredAt: new Date('2026-11-17T10:00:00Z'),
      bookId: 7,
      bookTitle: 'Dune',
      bookAuthor: 'Frank Herbert',
      rating: null,
      url: 'https://library.grib.co/book/7',
      ...overrides,
    };
  }

  it('renders a finished line without a rating', () => {
    expect(renderFinishedItem(finished())).toBe('Finished [Dune](https://library.grib.co/book/7) by Frank Herbert.');
  });

  it('adds a Rating line when rated', () => {
    const rendered = renderFinishedItem(finished({ rating: 4 }));
    expect(rendered).toBe('Finished [Dune](https://library.grib.co/book/7) by Frank Herbert.\n\nRating: 4/5');
  });
});

describe('renderDayBlock', () => {
  it('adds the BookOrbit heading only when includeHeading is true', () => {
    const withHeading = renderDayBlock([annotation()], true);
    const withoutHeading = renderDayBlock([annotation()], false);
    expect(withHeading.startsWith('## BookOrbit\n\n')).toBe(true);
    expect(withoutHeading.startsWith('## BookOrbit')).toBe(false);
  });

  it('joins multiple items in the order given', () => {
    const rendered = renderDayBlock([annotation({ sourceKey: '1', text: 'first' }), annotation({ sourceKey: '2', text: 'second' })], false);
    expect(rendered.indexOf('first')).toBeLessThan(rendered.indexOf('second'));
  });
});
