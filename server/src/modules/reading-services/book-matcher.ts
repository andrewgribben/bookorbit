// Pure matching logic shared by every provider's initial migration. No I/O: callers build the
// remote index once (see buildRemoteIndex) and reuse it across every local book being matched.

export interface RemoteIndexBook {
  externalId: string;
  isbn13?: string | null;
  isbn10?: string | null;
  title?: string | null;
  author?: string | null;
}

export interface LocalMatchableBook {
  isbn13: string | null;
  isbn10: string | null;
  title: string;
  author: string | null;
}

export type BookMatchMethod = 'isbn13' | 'isbn10' | 'title_author';

export interface BookMatchResult {
  method: BookMatchMethod;
  externalId: string;
}

export interface RemoteBookIndex {
  byIsbn13: Map<string, string>;
  byTitleAuthor: Map<string, string>;
}

const LEADING_ARTICLES = /^(a|an|the)\s+/i;

/** lowercase, strip punctuation and a leading article, collapse whitespace */
function normalizeTitlePart(value: string): string {
  return value
    .toLowerCase()
    .replace(LEADING_ARTICLES, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTitleAuthorKey(title: string, author: string | null | undefined): string {
  const normalizedTitle = normalizeTitlePart(title ?? '');
  const normalizedAuthor = normalizeTitlePart(author ?? '');
  return `${normalizedTitle}|${normalizedAuthor}`;
}

/** ISBN-10 -> ISBN-13 (978 prefix with a recomputed check digit). Returns null when malformed. */
export function isbn10ToIsbn13(isbn10: string): string | null {
  const digits = isbn10.replace(/[^0-9Xx]/g, '');
  if (digits.length !== 10) return null;
  const core = `978${digits.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < core.length; i++) {
    const digit = Number(core[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${core}${checkDigit}`;
}

/** Builds lookup maps once per migration run; later matches are O(1) per local book. */
export function buildRemoteIndex(books: RemoteIndexBook[]): RemoteBookIndex {
  const byIsbn13 = new Map<string, string>();
  const byTitleAuthor = new Map<string, string>();

  for (const book of books) {
    if (book.isbn13) byIsbn13.set(book.isbn13, book.externalId);
    if (book.isbn10) {
      const converted = isbn10ToIsbn13(book.isbn10);
      if (converted) byIsbn13.set(converted, book.externalId);
    }
    if (book.title) {
      const key = normalizeTitleAuthorKey(book.title, book.author);
      byTitleAuthor.set(key, book.externalId);
    }
  }

  return { byIsbn13, byTitleAuthor };
}

/** Match order: isbn13, then isbn10 converted to isbn13, then normalized title+author. */
export function matchBook(local: LocalMatchableBook, index: RemoteBookIndex): BookMatchResult | null {
  if (local.isbn13) {
    const externalId = index.byIsbn13.get(local.isbn13);
    if (externalId) return { method: 'isbn13', externalId };
  }
  if (local.isbn10) {
    const converted = isbn10ToIsbn13(local.isbn10);
    if (converted) {
      const externalId = index.byIsbn13.get(converted);
      if (externalId) return { method: 'isbn10', externalId };
    }
  }
  const key = normalizeTitleAuthorKey(local.title, local.author);
  const externalId = index.byTitleAuthor.get(key);
  if (externalId) return { method: 'title_author', externalId };
  return null;
}
