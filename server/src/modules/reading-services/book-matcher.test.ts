import { describe, expect, it } from 'vitest';

import { buildRemoteIndex, isbn10ToIsbn13, matchBook, normalizeTitleAuthorKey, type RemoteIndexBook } from './book-matcher';

describe('isbn10ToIsbn13', () => {
  it('converts a known isbn10 to its isbn13 form', () => {
    // 0-306-40615-2 -> 978-0-306-40615-7 (well known conversion example)
    expect(isbn10ToIsbn13('0306406152')).toBe('9780306406157');
  });

  it('returns null for malformed input', () => {
    expect(isbn10ToIsbn13('not-an-isbn')).toBeNull();
  });
});

describe('normalizeTitleAuthorKey', () => {
  it('lowercases, strips punctuation, strips a leading article and collapses whitespace', () => {
    expect(normalizeTitleAuthorKey('The Hobbit!', 'J.R.R. Tolkien')).toBe('hobbit|jrr tolkien');
  });

  it('treats a missing author as an empty segment', () => {
    expect(normalizeTitleAuthorKey('Dune', null)).toBe('dune|');
  });
});

describe('matchBook', () => {
  it('matches by isbn13 first', () => {
    const index = buildRemoteIndex([{ externalId: 'r1', isbn13: '9780306406157', title: 'Other Title' }]);
    const result = matchBook({ isbn13: '9780306406157', isbn10: null, title: 'Some Title', author: null }, index);
    expect(result).toEqual({ method: 'isbn13', externalId: 'r1' });
  });

  it('matches by isbn10 converted to isbn13 when no direct isbn13 match', () => {
    const index = buildRemoteIndex([{ externalId: 'r1', isbn13: '9780306406157' }]);
    const result = matchBook({ isbn13: null, isbn10: '0306406152', title: 'Some Title', author: null }, index);
    expect(result).toEqual({ method: 'isbn10', externalId: 'r1' });
  });

  it('matches by normalized title and author when no isbn matches', () => {
    const index = buildRemoteIndex([{ externalId: 'r1', title: 'The Hobbit', author: 'J.R.R. Tolkien' }]);
    const result = matchBook({ isbn13: null, isbn10: null, title: 'hobbit', author: 'jrr tolkien' }, index);
    expect(result).toEqual({ method: 'title_author', externalId: 'r1' });
  });

  it('returns null when nothing matches', () => {
    const index = buildRemoteIndex([{ externalId: 'r1', isbn13: '9780000000000', title: 'Unrelated' }]);
    const result = matchBook({ isbn13: '9781111111111', isbn10: null, title: 'Also Unrelated', author: null }, index);
    expect(result).toBeNull();
  });

  it('prefers isbn13 over a title match that would resolve to a different book', () => {
    const index = buildRemoteIndex([
      { externalId: 'by-isbn', isbn13: '9780306406157', title: 'Decoy Title' },
      { externalId: 'by-title', title: 'Some Title', author: 'Some Author' },
    ]);
    const result = matchBook({ isbn13: '9780306406157', isbn10: null, title: 'Some Title', author: 'Some Author' }, index);
    expect(result).toEqual({ method: 'isbn13', externalId: 'by-isbn' });
  });

  it('collapses two local editions onto one remote book id (edition collapse)', () => {
    const index = buildRemoteIndex([{ externalId: 'shared-remote', isbn13: '9780306406157' }]);
    const paperback = matchBook({ isbn13: '9780306406157', isbn10: null, title: 'Paperback Edition', author: null }, index);
    const ebook = matchBook({ isbn13: null, isbn10: '0306406152', title: 'Ebook Edition', author: null }, index);
    expect(paperback?.externalId).toBe('shared-remote');
    expect(ebook?.externalId).toBe('shared-remote');
  });

  it('skips remote books with product:null (no isbn or title) during index build', () => {
    const books: RemoteIndexBook[] = [{ externalId: 'no-product' }, { externalId: 'r1', isbn13: '9781111111111' }];
    const index = buildRemoteIndex(books);
    expect(index.byIsbn13.size).toBe(1);
    expect(index.byTitleAuthor.size).toBe(0);
    const result = matchBook({ isbn13: '9781111111111', isbn10: null, title: 'X', author: null }, index);
    expect(result).toEqual({ method: 'isbn13', externalId: 'r1' });
  });

  it('does not match a local book against a remote entry with a product:null placeholder', () => {
    const index = buildRemoteIndex([{ externalId: 'no-product' }]);
    const result = matchBook({ isbn13: null, isbn10: null, title: 'Anything', author: null }, index);
    expect(result).toBeNull();
  });
});
