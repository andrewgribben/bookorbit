import { describe, expect, it } from 'vitest';

import { findTkAnchor, noteContainsLinkTo } from './tk-tiptap.utils';
import type { TkDailyNoteDoc } from './tk.types';

describe('noteContainsLinkTo', () => {
  it('returns false for an empty document', () => {
    expect(noteContainsLinkTo({ type: 'doc', content: [] }, 'https://example.com')).toBe(false);
  });

  it('finds a link mark nested inside a paragraph', () => {
    const doc: TkDailyNoteDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Dune', marks: [{ type: 'link', attrs: { href: 'https://library.grib.co/book/7' } }] }],
        },
      ],
    };
    expect(noteContainsLinkTo(doc, 'https://library.grib.co/book/7')).toBe(true);
    expect(noteContainsLinkTo(doc, 'https://library.grib.co/book/8')).toBe(false);
  });
});

describe('findTkAnchor', () => {
  it('anchors on the last top-level node and asks for a heading when the note has no BookOrbit section', () => {
    const doc: TkDailyNoteDoc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { id: 'h1', level: 1 }, content: [{ type: 'text', text: 'Daily note' }] },
        { type: 'paragraph', attrs: { id: 'p1' }, content: [{ type: 'text', text: 'Some journal entry' }] },
      ],
    };
    expect(findTkAnchor(doc)).toEqual({ anchorNodeId: 'p1', needsHeading: true });
  });

  it('anchors on the last node of an existing BookOrbit section, not later sections', () => {
    const doc: TkDailyNoteDoc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { id: 'h1', level: 1 }, content: [{ type: 'text', text: 'Daily note' }] },
        { type: 'heading', attrs: { id: 'h2', level: 2 }, content: [{ type: 'text', text: 'BookOrbit' }] },
        { type: 'paragraph', attrs: { id: 'p1' }, content: [{ type: 'text', text: 'First item' }] },
        { type: 'paragraph', attrs: { id: 'p2' }, content: [{ type: 'text', text: 'Second item' }] },
        { type: 'heading', attrs: { id: 'h3', level: 2 }, content: [{ type: 'text', text: 'Notes for TK' }] },
        { type: 'paragraph', attrs: { id: 'p3' }, content: [{ type: 'text', text: 'Unrelated' }] },
      ],
    };
    expect(findTkAnchor(doc)).toEqual({ anchorNodeId: 'p2', needsHeading: false });
  });

  it('anchors on the heading itself when the BookOrbit section has no items yet', () => {
    const doc: TkDailyNoteDoc = {
      type: 'doc',
      content: [{ type: 'heading', attrs: { id: 'h2', level: 2 }, content: [{ type: 'text', text: 'BookOrbit' }] }],
    };
    expect(findTkAnchor(doc)).toEqual({ anchorNodeId: 'h2', needsHeading: false });
  });

  it('treats a level-1 heading after the BookOrbit section as ending it too', () => {
    const doc: TkDailyNoteDoc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { id: 'h2', level: 2 }, content: [{ type: 'text', text: 'BookOrbit' }] },
        { type: 'paragraph', attrs: { id: 'p1' }, content: [{ type: 'text', text: 'First item' }] },
        { type: 'heading', attrs: { id: 'h4', level: 1 }, content: [{ type: 'text', text: 'Another title' }] },
      ],
    };
    expect(findTkAnchor(doc)).toEqual({ anchorNodeId: 'p1', needsHeading: false });
  });

  it('returns a null anchor for a note with no top-level nodes', () => {
    expect(findTkAnchor({ type: 'doc', content: [] })).toEqual({ anchorNodeId: null, needsHeading: true });
  });
});
