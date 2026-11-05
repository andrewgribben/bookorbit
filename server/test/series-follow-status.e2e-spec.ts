import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';

import * as schema from '../src/db/schema';
import {
  authHeader,
  closeReaderStateIsolationE2EContext,
  createLibraryWithFolder,
  createReaderStateIsolationE2EContext,
  createUserAndLogin,
  grantLibraryAccess,
  type CreatedLibrary,
  type ReaderStateIsolationE2EContext,
  type TestUserSession,
} from './e2e/reader-state-isolation/reader-state-isolation-harness';
import type { DashboardScrollerBatchResponse, SeriesBooksPage } from '@bookorbit/types';

const TOKEN = `follow${randomUUID().slice(0, 8)}`;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

describe('Series follow status and Up Next (e2e)', { timeout: 300_000 }, () => {
  let ctx!: ReaderStateIsolationE2EContext;
  let library!: CreatedLibrary;
  let hidden!: CreatedLibrary;
  let reader!: TestUserSession;
  let inoCounter = 2_000_000n;
  const series: Record<string, number> = {};
  const books: Record<string, number> = {};

  async function createSeries(key: string): Promise<number> {
    const name = `${TOKEN} ${key}`;
    const [row] = await ctx.db.insert(schema.bookSeries).values({ name, normalizedName: name.toLowerCase() }).returning({ id: schema.bookSeries.id });
    series[key] = row!.id;
    return row!.id;
  }

  async function seedBook(key: string, seriesKey: string, index: string, opts: { read?: boolean; finishedAt?: Date; target?: CreatedLibrary } = {}) {
    const target = opts.target ?? library;
    const folder = `${target.folderPath}/${key}-${randomUUID()}`;
    const [book] = await ctx.db
      .insert(schema.books)
      .values({ libraryId: target.libraryId, libraryFolderId: target.libraryFolderId, folderPath: folder, status: 'present' })
      .returning({ id: schema.books.id });
    const bookId = book!.id;
    const seriesId = series[seriesKey]!;
    await ctx.db.insert(schema.bookMetadata).values({ bookId, title: `${TOKEN} ${key}`, seriesId, seriesIndex: index });
    await ctx.db.insert(schema.bookSeriesMemberships).values({ bookId, seriesId, seriesIndex: index });
    inoCounter += 1n;
    const [file] = await ctx.db
      .insert(schema.bookFiles)
      .values({
        bookId,
        libraryFolderId: target.libraryFolderId,
        absolutePath: `${folder}/book.epub`,
        relPath: `${key}/book.epub`,
        ino: inoCounter,
        format: 'epub',
        role: 'content',
        sizeBytes: 2048,
        sortOrder: 0,
      })
      .returning({ id: schema.bookFiles.id });
    await ctx.db.update(schema.books).set({ primaryFileId: file!.id }).where(eq(schema.books.id, bookId));
    if (opts.read) {
      await ctx.db.insert(schema.userBookStatus).values({
        userId: reader.userId,
        bookId,
        status: 'read',
        source: 'manual',
        finishedAt: opts.finishedAt ?? new Date(),
      });
    }
    books[key] = bookId;
    return bookId;
  }

  async function upNext(maxAgeMonths?: number) {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/dashboard/scrollers/batch',
      headers: authHeader(reader.accessToken),
      payload: { items: [{ id: 'up-next', type: 'up-next-in-series', limit: 50, ...(maxAgeMonths ? { maxAgeMonths } : {}) }] },
    });
    expect(response.statusCode, response.body).toBe(200);
    const item = (response.json() as DashboardScrollerBatchResponse).items[0]!;
    expect(item.failed).toBe(false);
    return { ids: item.books.map((book) => book.id), lastActivityAt: item.lastActivityAt ?? {} };
  }

  async function setStatus(seriesKey: string, status: string) {
    return ctx.app.inject({
      method: 'PUT',
      url: `/api/v1/series/${series[seriesKey]}/status`,
      headers: authHeader(reader.accessToken),
      payload: { status },
    });
  }

  async function queryIds(rule: Record<string, unknown>): Promise<number[]> {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/books/query',
      headers: authHeader(reader.accessToken),
      payload: {
        filter: { type: 'group', join: 'AND', rules: [{ type: 'rule', field: 'title', operator: 'contains', value: TOKEN }, rule] },
        sort: [{ field: 'title', dir: 'asc' }],
        pagination: { page: 0, size: 100 },
      },
    });
    expect(response.statusCode, response.body).toBe(201);
    return (response.json() as { items: { id: number }[] }).items.map((item) => item.id).sort((a, b) => a - b);
  }

  async function readStatus(key: string): Promise<string | null> {
    const [row] = await ctx.db
      .select({ status: schema.userBookStatus.status })
      .from(schema.userBookStatus)
      .where(and(eq(schema.userBookStatus.userId, reader.userId), eq(schema.userBookStatus.bookId, books[key]!)));
    return row?.status ?? null;
  }

  beforeAll(async () => {
    ctx = await createReaderStateIsolationE2EContext();
    library = await createLibraryWithFolder(ctx, { name: `${TOKEN} Comics` });
    hidden = await createLibraryWithFolder(ctx, { name: `${TOKEN} Hidden` });
    reader = await createUserAndLogin(ctx);
    await grantLibraryAccess(ctx, reader.userId, library.libraryId);

    for (const key of ['following', 'dropped', 'caughtUp', 'stale', 'markRead', 'private']) await createSeries(key);
    await seedBook('following-1', 'following', '1', { read: true, finishedAt: new Date(Date.now() - MONTH_MS) });
    await seedBook('following-2', 'following', '2');
    await seedBook('dropped-1', 'dropped', '1', { read: true });
    await seedBook('dropped-2', 'dropped', '2');
    await seedBook('caughtUp-1', 'caughtUp', '1', { read: true });
    await seedBook('caughtUp-2', 'caughtUp', '2', { read: true });
    await seedBook('stale-1', 'stale', '1', { read: true, finishedAt: new Date(Date.now() - 24 * MONTH_MS) });
    await seedBook('stale-2', 'stale', '2');
    for (const index of ['1', '2', '3', '4']) await seedBook(`markRead-${index}`, 'markRead', index, { read: index === '2' });
    await seedBook('private-1', 'private', '1', { target: hidden });
  });

  afterAll(async () => {
    if (ctx) await closeReaderStateIsolationE2EContext(ctx);
  });

  it('lists the next book of every started series before any status is set', async () => {
    const { ids } = await upNext();
    expect(ids).toEqual(expect.arrayContaining([books['following-2'], books['dropped-2'], books['stale-2']]));
    expect(ids).not.toContain(books['caughtUp-2']);
  });

  it('drops a series from Up Next but keeps it findable through the library filter', async () => {
    const response = await setStatus('dropped', 'dropped');
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({ seriesId: series.dropped, status: 'dropped' });

    expect((await upNext()).ids).not.toContain(books['dropped-2']);
    expect(await queryIds({ type: 'rule', field: 'seriesStatus', operator: 'includesAny', value: ['dropped'] })).toEqual(
      [books['dropped-1'], books['dropped-2']].sort((a, b) => a! - b!),
    );
    expect(await queryIds({ type: 'rule', field: 'seriesStatus', operator: 'isUpNext' })).not.toContain(books['dropped-2']);

    const page = await ctx.app.inject({ method: 'GET', url: `/api/v1/series/${series.dropped}/books`, headers: authHeader(reader.accessToken) });
    expect((page.json() as SeriesBooksPage).seriesInfo.followStatus).toBe('dropped');
  });

  it('brings a caught-up series back only when a newer book arrives', async () => {
    expect((await setStatus('caughtUp', 'caught_up')).statusCode).toBe(200);
    const newBook = await seedBook('caughtUp-3', 'caughtUp', '3');
    expect((await upNext()).ids).toContain(newBook);

    expect((await setStatus('following', 'caught_up')).statusCode).toBe(200);
    expect((await upNext()).ids).not.toContain(books['following-2']);
    expect((await setStatus('following', 'reading')).statusCode).toBe(200);
    expect((await upNext()).ids).toContain(books['following-2']);
  });

  it('applies the activity cut-off to the dashboard shelf only and reports last activity', async () => {
    const { ids, lastActivityAt } = await upNext(12);
    expect(ids).toContain(books['following-2']);
    expect(ids).not.toContain(books['stale-2']);
    expect(lastActivityAt[books['following-2']!]).toEqual(expect.any(String));

    expect(await queryIds({ type: 'rule', field: 'seriesStatus', operator: 'isUpNext' })).toContain(books['stale-2']);
  });

  it('marks a series read up to a book, skipping books already read', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/series/${series.markRead}/mark-read`,
      headers: authHeader(reader.accessToken),
      payload: { upToBookId: books['markRead-3'] },
    });
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json()).toEqual({ updated: 2 });
    expect(await readStatus('markRead-1')).toBe('read');
    expect(await readStatus('markRead-3')).toBe('read');
    expect(await readStatus('markRead-4')).toBeNull();

    const all = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/series/${series.markRead}/mark-read`,
      headers: authHeader(reader.accessToken),
      payload: {},
    });
    expect(all.json()).toEqual({ updated: 1 });
    expect(await readStatus('markRead-4')).toBe('read');
  });

  it('rejects series and books the user cannot reach', async () => {
    expect((await setStatus('private', 'reading')).statusCode).toBe(404);
    const outsider = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/series/${series.markRead}/mark-read`,
      headers: authHeader(reader.accessToken),
      payload: { upToBookId: books['following-2'] },
    });
    expect(outsider.statusCode).toBe(400);
    expect((await setStatus('following', 'finished')).statusCode).toBe(400);
  });
});
