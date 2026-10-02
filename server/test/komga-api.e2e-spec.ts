import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';

import { Permission } from '@bookorbit/types';
import * as schema from '../src/db/schema';
import { createZipArchiveFixture } from './e2e/metadata-write/metadata-write-fixture-builder';
import { createEpubFixture } from './e2e/opds/opds-fixture-builder';
import { createKomgaE2EContext } from './e2e/komga/komga-harness';
import {
  basicAuth,
  closeOpdsE2EContext,
  createBookCoverArtifacts,
  createLibraryWithFolder,
  createUserAndLogin,
  grantLibraryAccess,
  locateBookByAbsolutePath,
  triggerAndWaitForLibraryScan,
  type CreatedLibrary,
  type LocatedBookFile,
  type OpdsE2EContext,
  type TestUserSession,
} from './e2e/opds/opds-harness';

const KOMGA = '/komga';
const ONE_PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const COMIC_INFO = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<ComicInfo><Title>Komga Contract Comic</Title><Series>Komga Contract Series</Series><Number>1</Number><PageCount>3</PageCount></ComicInfo>',
  '',
].join('\n');

interface CreatedUser extends TestUserSession {
  credentials: string;
}

describe('Komga API (e2e)', { timeout: 120_000 }, () => {
  let ctx: OpdsE2EContext;
  let library: CreatedLibrary;
  let comic: LocatedBookFile;
  let epub: LocatedBookFile;
  let epubSeriesName: string;
  let reader: CreatedUser;
  let intruder: CreatedUser;
  let outsider: CreatedUser;
  let downloader: CreatedUser;

  async function request(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, user: CreatedUser, payload?: Record<string, unknown>) {
    return ctx.app.inject({
      method,
      url: `${KOMGA}${path}`,
      headers: { authorization: user.credentials },
      ...(payload === undefined ? {} : { payload }),
    });
  }

  async function createUserWithAccess(permissions: Permission[], accessLevel: 'viewer' | 'editor' | 'owner'): Promise<CreatedUser> {
    const session = await createUserAndLogin(ctx, { permissions });
    await grantLibraryAccess(ctx, session.userId, library.libraryId, accessLevel);
    return { ...session, credentials: basicAuth(session.username, session.password) };
  }

  beforeAll(async () => {
    ctx = await createKomgaE2EContext();
    library = await createLibraryWithFolder(ctx, { name: `komga-${randomUUID()}`, allowedFormats: ['cbz', 'epub'] });

    const comicPath = await createZipArchiveFixture(library.folderPath, 'komga-contract.cbz', [
      { path: 'ComicInfo.xml', content: COMIC_INFO },
      { path: 'pages/001.png', content: ONE_PIXEL_PNG },
      { path: 'pages/002.png', content: ONE_PIXEL_PNG },
      { path: 'pages/003.png', content: ONE_PIXEL_PNG },
    ]);
    await triggerAndWaitForLibraryScan(ctx, library.libraryId);
    comic = await locateBookByAbsolutePath(ctx, comicPath);
    await createBookCoverArtifacts(ctx, comic.bookId);

    // Metadata extraction is stubbed in this harness, so the rows the DTOs read are seeded directly.
    // `book_metadata.series_id` is what BookDetailDto reports, while memberships drive series pages.
    const seriesName = `Komga Contract Series ${randomUUID().slice(0, 8)}`;
    const [series] = await ctx.db
      .insert(schema.bookSeries)
      .values({ name: seriesName, normalizedName: seriesName.toLowerCase() })
      .returning({ id: schema.bookSeries.id });
    // Seeding is idempotent: a rerun without a database reset must not collide with its own rows.
    await ctx.db.delete(schema.bookSeriesMemberships).where(eq(schema.bookSeriesMemberships.bookId, comic.bookId));
    await ctx.db.insert(schema.bookSeriesMemberships).values({ bookId: comic.bookId, seriesId: series.id, seriesIndex: '1', displayOrder: 0 });

    const metadataValues = {
      bookId: comic.bookId,
      title: 'Komga Contract Comic',
      description: 'Seeded for the Komga contract test.',
      pageCount: 3,
      isbn13: '9780000000002',
      publisher: 'Contract Press',
      publishedDate: '2026-01-05',
      language: 'en',
      coverSource: 'custom',
      seriesId: series.id,
      seriesName,
      seriesIndex: '1',
    };
    await ctx.db.insert(schema.bookMetadata).values(metadataValues).onConflictDoUpdate({ target: schema.bookMetadata.bookId, set: metadataValues });

    // The EPUB path: Komga clients read it through the webpub manifest and `/resource/`. Its
    // membership is seeded without `book_metadata.series_id`, which is the state the scanner leaves
    // behind and the one that used to produce an empty seriesId on the book detail route.
    const epubPath = await createEpubFixture(library.folderPath, 'komga-replay.epub', { title: 'Replay EPUB' });
    await triggerAndWaitForLibraryScan(ctx, library.libraryId);
    epub = await locateBookByAbsolutePath(ctx, epubPath);
    await createBookCoverArtifacts(ctx, epub.bookId);

    epubSeriesName = `Komga EPUB Series ${randomUUID().slice(0, 8)}`;
    const [epubSeries] = await ctx.db
      .insert(schema.bookSeries)
      .values({ name: epubSeriesName, normalizedName: epubSeriesName.toLowerCase() })
      .returning({ id: schema.bookSeries.id });
    await ctx.db.delete(schema.bookSeriesMemberships).where(eq(schema.bookSeriesMemberships.bookId, epub.bookId));
    await ctx.db.insert(schema.bookSeriesMemberships).values({ bookId: epub.bookId, seriesId: epubSeries.id, seriesIndex: '1', displayOrder: 0 });
    const epubMetadata = { bookId: epub.bookId, title: 'Replay EPUB', language: 'en', coverSource: 'custom' };
    await ctx.db.insert(schema.bookMetadata).values(epubMetadata).onConflictDoUpdate({ target: schema.bookMetadata.bookId, set: epubMetadata });

    reader = await createUserWithAccess([Permission.LibraryDownload], 'viewer');
    intruder = await createUserWithAccess([], 'viewer');
    const outsiderSession = await createUserAndLogin(ctx, {});
    outsider = { ...outsiderSession, credentials: basicAuth(outsiderSession.username, outsiderSession.password) };
    downloader = await createUserWithAccess([], 'viewer');
  });

  afterAll(async () => {
    await closeOpdsE2EContext(ctx);
  });

  it('authenticates with Basic credentials and rejects bad ones', async () => {
    const ok = await request('GET', '/api/v1/libraries', reader);
    expect(ok.statusCode).toBe(200);

    const rejected = await ctx.app.inject({
      method: 'GET',
      url: `${KOMGA}/api/v1/libraries`,
      headers: { authorization: basicAuth(reader.username, 'not-the-password') },
    });
    expect(rejected.statusCode).toBe(401);
    expect(rejected.headers['www-authenticate']).toContain('Basic');

    const anonymous = await ctx.app.inject({ method: 'GET', url: `${KOMGA}/api/v1/libraries` });
    expect(anonymous.statusCode).toBe(401);
  });

  it('issues, accepts and revokes an API key', async () => {
    const created = await request('POST', '/api/v2/users/me/api-keys', reader, { comment: 'Komelia' });
    expect(created.statusCode).toBe(200);
    const apiKey = created.json() as { id: string; key: string; comment: string };
    expect(apiKey.key.startsWith('bko_')).toBe(true);
    expect(apiKey.comment).toBe('Komelia');

    const withKey = await ctx.app.inject({ method: 'GET', url: `${KOMGA}/api/v2/users/me`, headers: { 'x-api-key': apiKey.key } });
    expect(withKey.statusCode).toBe(200);
    expect((withKey.json() as { id: string }).id).toBe(String(reader.userId));

    const listed = await request('GET', '/api/v2/users/me/api-keys', reader);
    const listedKeys = listed.json() as { id: string; key: string }[];
    expect(listedKeys).toHaveLength(1);
    expect(listedKeys[0].key).not.toBe(apiKey.key);
    expect(listedKeys[0].key.endsWith('...')).toBe(true);

    const revoked = await request('DELETE', `/api/v2/users/me/api-keys/${apiKey.id}`, reader);
    expect(revoked.statusCode).toBe(204);

    const afterRevoke = await ctx.app.inject({ method: 'GET', url: `${KOMGA}/api/v2/users/me`, headers: { 'x-api-key': apiKey.key } });
    expect(afterRevoke.statusCode).toBe(401);
  });

  it('reports the libraries the user can see', async () => {
    const response = await request('GET', '/api/v1/libraries', reader);
    expect(response.statusCode).toBe(200);

    const libraries = response.json() as { id: string; name: string; root: string; scanCbx: boolean }[];
    const visible = libraries.find((entry) => entry.id === String(library.libraryId));
    expect(visible).toBeDefined();
    expect(visible?.root).toBe(library.folderPath);
    expect(visible?.scanCbx).toBe(true);
  });

  it('lists series in the paged envelope Komga clients read', async () => {
    const response = await request('GET', '/api/v1/series', reader);
    expect(response.statusCode).toBe(200);

    const page = response.json() as {
      content: { id: string; name: string; booksCount: number; booksMetadata: { authors: unknown[] } }[];
      totalElements: number;
      pageable: { pageNumber: number; pageSize: number };
    };
    expect(page.totalElements).toBeGreaterThanOrEqual(1);
    expect(page.pageable.pageNumber).toBe(0);
    expect(page.pageable.pageSize).toBe(20);
    expect(page.content.some((series) => series.booksCount === 1)).toBe(true);
  });

  it('returns a book with the required Komga fields and its seeded metadata', async () => {
    const response = await request('GET', `/api/v1/books/${comic.bookId}`, reader);
    expect(response.statusCode).toBe(200);

    const book = response.json() as Record<string, unknown> & {
      media: { pagesCount: number; mediaType: string; status: string };
      metadata: { title: string; isbn: string; number: string };
      readProgress?: { page: number };
    };
    expect(book.id).toBe(String(comic.bookId));
    expect(book.libraryId).toBe(String(library.libraryId));
    expect(book.sizeBytes).toBeGreaterThan(0);
    expect(book.url).toBe(`${KOMGA}/api/v1/books/${comic.bookId}`);
    expect(book.media.pagesCount).toBe(3);
    expect(book.media.mediaType).toBe('application/vnd.comicbook+zip');
    expect(book.media.status).toBe('READY');
    expect(book.metadata.title).toBe('Komga Contract Comic');
    expect(book.metadata.isbn).toBe('9780000000002');
    expect(book.metadata.number).toBe('1');
    expect(book.seriesId).not.toBe('');
    expect(book.readProgress).toBeUndefined();
  });

  it('serves the book thumbnail and cover once artifacts exist', async () => {
    const thumbnail = await request('GET', `/api/v1/books/${comic.bookId}/thumbnail`, reader);
    expect(thumbnail.statusCode).toBe(200);
    expect(thumbnail.headers['content-type']).toContain('image/jpeg');
  });

  it('lists the archive pages and streams one of them', async () => {
    const pages = await request('GET', `/api/v1/books/${comic.bookId}/pages`, reader);
    expect(pages.statusCode).toBe(200);

    const entries = pages.json() as { fileName: string; number: number; mediaType: string }[];
    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.number)).toEqual([1, 2, 3]);
    expect(entries.every((entry) => entry.fileName.endsWith('.png'))).toBe(true);
    expect(entries[0].mediaType).toBe('image/png');

    const firstPage = await request('GET', `/api/v1/books/${comic.bookId}/pages/1`, reader);
    expect(firstPage.statusCode).toBe(200);
    expect(firstPage.headers['content-type']).toContain('image/png');

    const outOfRange = await request('GET', `/api/v1/books/${comic.bookId}/pages/9`, reader);
    expect(outOfRange.statusCode).toBe(404);
  });

  it('answers an ebook-format book with an empty page list and refuses to stream one of its pages', async () => {
    // The same book, but with the primary file's format presented as an ebook to the reader path.
    const chapter = await ctx.db.update(schema.bookFiles).set({ format: 'epub' }).where(eq(schema.bookFiles.id, comic.bookFileId));
    expect(chapter.rowCount).toBe(1);

    try {
      // Komga's analyzed `media.pages` is empty for an ebook, so the list route is a bare array.
      const list = await request('GET', `/api/v1/books/${comic.bookId}/pages`, reader);
      expect(list.statusCode).toBe(200);
      expect(list.json()).toEqual([]);

      const streamed = await request('GET', `/api/v1/books/${comic.bookId}/pages/1`, reader);
      expect(streamed.statusCode).toBe(400);
    } finally {
      await ctx.db.update(schema.bookFiles).set({ format: 'cbz' }).where(eq(schema.bookFiles.id, comic.bookFileId));
    }
  });

  it('writes and reads book read progress', async () => {
    const written = await request('PATCH', `/api/v1/books/${comic.bookId}/read-progress`, reader, { page: 2 });
    expect(written.statusCode).toBe(204);

    const book = await request('GET', `/api/v1/books/${comic.bookId}`, reader);
    const body = book.json() as { readProgress: { page: number; completed: boolean } };
    expect(body.readProgress.page).toBe(2);
    expect(body.readProgress.completed).toBe(false);

    const completed = await request('PATCH', `/api/v1/books/${comic.bookId}/read-progress`, reader, { completed: true });
    expect(completed.statusCode).toBe(204);

    const afterCompletion = await request('GET', `/api/v1/books/${comic.bookId}`, reader);
    expect((afterCompletion.json() as { readProgress: { completed: boolean } }).readProgress.completed).toBe(true);
  });

  it('marks a whole series read and then resets it', async () => {
    const book = await request('GET', `/api/v1/books/${comic.bookId}`, reader);
    const seriesId = (book.json() as { seriesId: string }).seriesId;

    const marked = await request('POST', `/api/v1/series/${seriesId}/read-progress`, reader);
    expect(marked.statusCode).toBe(204);
    const afterMark = await request('GET', `/api/v1/books/${comic.bookId}`, reader);
    expect((afterMark.json() as { readProgress: { completed: boolean } }).readProgress.completed).toBe(true);

    const cleared = await request('DELETE', `/api/v1/series/${seriesId}/read-progress`, reader);
    expect(cleared.statusCode).toBe(204);
    const afterClear = await request('GET', `/api/v1/books/${comic.bookId}`, reader);
    expect((afterClear.json() as { readProgress: { completed: boolean } }).readProgress.completed).toBe(false);
  });

  it('gates the file download behind the download permission', async () => {
    const forbidden = await request('GET', `/api/v1/books/${comic.bookId}/file`, downloader);
    expect(forbidden.statusCode).toBe(403);

    const allowed = await request('GET', `/api/v1/books/${comic.bookId}/file`, reader);
    expect(allowed.statusCode).toBe(200);
    expect(allowed.headers['content-disposition']).toContain('attachment');
    expect(Number(allowed.headers['content-length'])).toBeGreaterThan(0);
  });

  it('serves the manifest, positions and progression for a comic', async () => {
    const manifest = await request('GET', `/api/v1/books/${comic.bookId}/manifest`, reader);
    expect(manifest.statusCode).toBe(200);
    expect(manifest.headers['content-type']).toContain('application/divina+json');
    const publication = manifest.json() as { readingOrder: { href: string }[]; metadata: { title: string } };
    expect(publication.readingOrder).toHaveLength(3);
    expect(publication.metadata.title).toBe('Komga Contract Comic');

    const positions = await request('GET', `/api/v1/books/${comic.bookId}/positions`, reader);
    expect(positions.statusCode).toBe(200);
    expect((positions.json() as { total: number }).total).toBe(3);

    const progression = await request('GET', `/api/v1/books/${comic.bookId}/progression`, reader);
    expect(progression.statusCode).toBe(200);

    const saved = await request('PUT', `/api/v1/books/${comic.bookId}/progression`, reader, {
      device: { id: 'device-1', name: 'Panels' },
      locator: { href: `/pages/3`, type: 'image/png', locations: { position: 3, totalProgression: 1 } },
      modified: new Date().toISOString(),
    });
    expect(saved.statusCode).toBe(204);
  });

  it('round-trips a readlist and keeps its membership order', async () => {
    const secondPath = await createZipArchiveFixture(library.folderPath, 'komga-second.cbz', [
      { path: 'ComicInfo.xml', content: COMIC_INFO },
      { path: 'pages/001.png', content: ONE_PIXEL_PNG },
    ]);
    await triggerAndWaitForLibraryScan(ctx, library.libraryId);
    const second = await locateBookByAbsolutePath(ctx, secondPath);

    const created = await request('POST', '/api/v1/readlists', reader, {
      name: `Order ${randomUUID().slice(0, 8)}`,
      summary: 'Read in this order',
      bookIds: [String(second.bookId), String(comic.bookId)],
    });
    expect(created.statusCode).toBe(200);
    const readList = created.json() as { id: string; bookIds: string[]; summary: string; ordered: boolean };
    expect(readList.bookIds).toEqual([String(second.bookId), String(comic.bookId)]);
    expect(readList.summary).toBe('Read in this order');
    expect(readList.ordered).toBe(true);

    const listed = await request('GET', '/api/v1/readlists', reader);
    const page = listed.json() as { content: { id: string; bookIds: string[] }[]; totalElements: number };
    expect(page.content.find((entry) => entry.id === readList.id)?.bookIds).toEqual([String(second.bookId), String(comic.bookId)]);

    const books = await request('GET', `/api/v1/readlists/${readList.id}/books`, reader);
    const bookPage = books.json() as { content: { id: string }[]; totalElements: number };
    expect(bookPage.totalElements).toBe(2);
    expect(bookPage.content.map((entry) => entry.id)).toEqual([String(second.bookId), String(comic.bookId)]);

    const reordered = await request('PATCH', `/api/v1/readlists/${readList.id}`, reader, {
      bookIds: [String(comic.bookId), String(second.bookId)],
    });
    expect(reordered.statusCode).toBe(204);
    const afterReorder = await request('GET', `/api/v1/readlists/${readList.id}`, reader);
    expect((afterReorder.json() as { bookIds: string[] }).bookIds).toEqual([String(comic.bookId), String(second.bookId)]);

    const readlistsForBook = await request('GET', `/api/v1/books/${comic.bookId}/readlists`, reader);
    expect((readlistsForBook.json() as { id: string }[]).some((entry) => entry.id === readList.id)).toBe(true);

    const deleted = await request('DELETE', `/api/v1/readlists/${readList.id}`, reader);
    expect(deleted.statusCode).toBe(204);
    const gone = await request('GET', `/api/v1/readlists/${readList.id}`, reader);
    expect(gone.statusCode).toBe(404);
  });

  it('projects Komga collections from BookOrbit collections', async () => {
    const response = await request('GET', '/api/v1/collections', reader);
    expect(response.statusCode).toBe(200);
    expect(Array.isArray((response.json() as { content: unknown[] }).content)).toBe(true);
  });

  it('keeps one user out of another user data', async () => {
    // `outsider` has no library access at all; `intruder` has viewer access but no download right.
    // A book outside the caller's libraries is answered with 404: the native API stopped disclosing
    // the existence of unshared books, and Komga hides them from unshared users the same way.
    const series = await request('GET', '/api/v1/series', outsider);
    expect(series.statusCode).toBe(200);
    expect((series.json() as { totalElements: number }).totalElements).toBe(0);

    const book = await request('GET', `/api/v1/books/${comic.bookId}`, outsider);
    expect(book.statusCode).toBe(404);

    const readLists = await request('GET', '/api/v1/readlists', outsider);
    expect((readLists.json() as { totalElements: number }).totalElements).toBe(0);

    const file = await request('GET', `/api/v1/books/${comic.bookId}/file`, outsider);
    expect(file.statusCode).toBe(404);

    const visibleToMember = await request('GET', '/api/v1/series', intruder);
    expect((visibleToMember.json() as { totalElements: number }).totalElements).toBeGreaterThanOrEqual(1);
  });

  it('answers the syncpoints reset with no content', async () => {
    const response = await request('DELETE', '/api/v1/syncpoints/me', reader);
    expect(response.statusCode).toBe(204);
  });

  it('reports unmappable search conditions instead of answering with the whole library', async () => {
    const response = await request('POST', '/api/v1/books/list', reader, { condition: { allOf: [] } });
    expect(response.statusCode).toBe(400);
  });

  it('caps unpaged listing requests instead of rejecting them', async () => {
    const response = await request('GET', '/api/v1/series?unpaged=true', reader);
    expect(response.statusCode).toBe(200);
    const page = response.json() as { pageable: { unpaged: boolean; paged: boolean } };
    expect(page.pageable).toMatchObject({ unpaged: true, paged: false });
  });

  /**
   * The requests KMReader 6.4 and Suwatte 3 actually sent on 2026-09-22 (bodies reconstructed from
   * their sources, byte sizes matched against the gateway log). Every one of them answered 400
   * because a condition clause the old parser did not know was rejected.
   */
  it('answers the condition bodies the shipping clients send', async () => {
    const cases: { body: Record<string, unknown>; expectSeries?: string }[] = [
      // Suwatte: 61 B, 68 B and 56 B bodies.
      { body: { condition: { readStatus: { operator: 'is', value: 'READ' } } } },
      { body: { condition: { readStatus: { operator: 'is', value: 'IN_PROGRESS' } } } },
      { body: { condition: { seriesId: { operator: 'is', value: String(comic.bookId) } } } },
      // KMReader: 73 B, 80 B, 84 B and 128-135 B bodies.
      { body: { condition: { anyOf: [{ readStatus: { operator: 'is', value: 'READ' } }] } } },
      { body: { condition: { anyOf: [{ readStatus: { operator: 'is', value: 'IN_PROGRESS' } }] } } },
      { body: { condition: { readStatus: { operator: 'isnot', value: 'READ' } }, fullTextSearch: '' } },
      {
        body: {
          condition: {
            allOf: [
              { libraryId: { operator: 'is', value: String(library.libraryId) } },
              { anyOf: [{ readStatus: { operator: 'is', value: 'READ' } }] },
            ],
          },
        },
      },
      { body: { condition: { anyOf: [{ libraryId: { operator: 'is', value: String(library.libraryId) } }] } } },
      // Komga's own camelCase operator spelling.
      { body: { condition: { allOf: [{ oneshot: { operator: 'isFalse' } }, { deleted: { operator: 'isFalse' } }] } } },
    ];

    for (const entry of cases) {
      const response = await request('POST', '/api/v1/books/list?page=0&size=20&sort=metadata.releaseDate,desc', reader, entry.body);
      expect(response.statusCode, JSON.stringify(entry.body)).toBe(200);
      expect(response.json()).toMatchObject({ content: expect.any(Array), totalElements: expect.any(Number) });
    }
  });

  it('scopes a series-id condition to that series', async () => {
    const book = await request('GET', `/api/v1/books/${comic.bookId}`, reader);
    const detail = book.json() as { seriesId: string };

    const scoped = await request('POST', '/api/v1/books/list', reader, {
      condition: { seriesId: { operator: 'is', value: detail.seriesId } },
    });
    expect(scoped.statusCode).toBe(200);
    const page = scoped.json() as { content: { seriesId: string }[]; totalElements: number };
    expect(page.totalElements).toBeGreaterThanOrEqual(1);
    expect(page.content.every((entry) => entry.seriesId === detail.seriesId)).toBe(true);

    const unrelated = await request('POST', '/api/v1/books/list', reader, {
      condition: { seriesId: { operator: 'is', value: String(Number(detail.seriesId) + 9999) } },
    });
    const empty = unrelated.json() as { totalElements: number };
    expect(empty.totalElements).toBe(0);
  });

  it('scopes a series list request by the condition body', async () => {
    const scoped = await request('POST', '/api/v1/series/list?page=0&size=20', reader, {
      condition: { libraryId: { operator: 'is', value: String(library.libraryId) } },
    });
    expect(scoped.statusCode).toBe(200);

    const other = await request('POST', '/api/v1/series/list?page=0&size=20', reader, {
      condition: { libraryId: { operator: 'is', value: String(library.libraryId + 9999) } },
    });
    const emptyPage = other.json() as { totalElements: number };
    expect(emptyPage.totalElements).toBe(0);
  });

  it('answers the list endpoints with 200, the status the pinned document declares', async () => {
    const books = await request('POST', '/api/v1/books/list', reader, {});
    expect(books.statusCode).toBe(200);
  });

  it('serves the EPUB webpub manifest the client needs to open the book', async () => {
    const response = await request('GET', `/api/v1/books/${epub.bookId}/manifest`, reader);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/webpub+json');

    const publication = response.json() as {
      context: string;
      metadata: { title: string; conformsTo: string; url: string };
      links: { rel?: string; href?: string }[];
      readingOrder: { href: string; type: string }[];
      resources: { href: string }[];
    };
    expect(publication.context).toBe('https://readium.org/webpub-manifest/context.jsonld');
    expect(publication.metadata.conformsTo).toBe('https://readium.org/webpub-manifest/profiles/epub');
    expect(publication.readingOrder).toHaveLength(1);
    expect(publication.readingOrder[0].href).toBe(`/komga/api/v1/books/${epub.bookId}/resource/OPS/chapter.xhtml`);
    expect(publication.readingOrder[0].type).toBe('application/xhtml+xml');
    expect(publication.resources.some((resource) => resource.href.endsWith('/thumbnail'))).toBe(true);

    const epubManifest = await request('GET', `/api/v1/books/${epub.bookId}/manifest/epub`, reader);
    expect(epubManifest.statusCode).toBe(200);

    // Komga does not gate this route on the profile: an EPUB yields an empty comic reading order.
    const divinaManifest = await request('GET', `/api/v1/books/${epub.bookId}/manifest/divina`, reader);
    expect(divinaManifest.statusCode).toBe(200);
    const divina = divinaManifest.json() as { readingOrder: unknown[] };
    expect(divina.readingOrder).toEqual([]);
  });

  it('streams an EPUB entry and reports its positions and progression', async () => {
    const resource = await request('GET', `/api/v1/books/${epub.bookId}/resource/OPS/chapter.xhtml`, reader);
    expect(resource.statusCode).toBe(200);
    expect(resource.headers['content-type']).toContain('application/xhtml+xml');
    expect(resource.body).toContain('fixture');

    const positions = await request('GET', `/api/v1/books/${epub.bookId}/positions`, reader);
    expect(positions.statusCode).toBe(200);
    const positionList = positions.json() as { total: number; positions: { href: string; locations: { position: number } }[] };
    expect(positionList.total).toBe(1);
    expect(positionList.positions[0].href).toContain('/resource/OPS/chapter.xhtml');

    const progression = await request('GET', `/api/v1/books/${epub.bookId}/progression`, reader);
    expect(progression.statusCode).toBe(200);

    const saved = await request('PUT', `/api/v1/books/${epub.bookId}/progression`, reader, {
      device: { id: 'device-1', name: 'KMReader' },
      locator: {
        href: `/komga/api/v1/books/${epub.bookId}/resource/OPS/chapter.xhtml`,
        type: 'application/xhtml+xml',
        locations: { totalProgression: 0.5 },
      },
      modified: new Date().toISOString(),
    });
    expect(saved.statusCode).toBe(204);

    const book = await request('GET', `/api/v1/books/${epub.bookId}`, reader);
    const detail = book.json() as { readProgress?: { page: number } };
    expect(detail.readProgress).toBeDefined();
  });

  it('reports the series a book belongs to even when the metadata row has none', async () => {
    const book = await request('GET', `/api/v1/books/${epub.bookId}`, reader);
    const detail = book.json() as { seriesId: string; seriesTitle: string };
    expect(detail.seriesId).not.toBe('');
    expect(detail.seriesTitle).toBe(epubSeriesName);
  });

  it('answers the trailing-slash series request the client makes for a standalone book with 404', async () => {
    const response = await request('GET', '/api/v1/series/', reader);
    expect(response.statusCode).toBe(404);
  });

  it('answers a logout request with no content', async () => {
    const response = await ctx.app.inject({ method: 'POST', url: `${KOMGA}/api/logout`, headers: { authorization: reader.credentials } });
    expect(response.statusCode).toBe(204);
  });

  it('lists no pages for an EPUB, the array Komga answers with', async () => {
    const response = await request('GET', `/api/v1/books/${epub.bookId}/pages`, reader);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });
});
