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
import { encodeMihonBackup, type MihonFixtureManga } from './fixtures/mihon-backup';
import type { DashboardScrollerBatchResponse, ReaderImportResult } from '@bookorbit/types';

const TOKEN = `rimport${randomUUID().slice(0, 8)}`;
const KOMGA = 'https://komga.example';

describe('Reader app backup import (e2e)', { timeout: 300_000 }, () => {
  let ctx!: ReaderStateIsolationE2EContext;
  let library!: CreatedLibrary;
  let hidden!: CreatedLibrary;
  let reader!: TestUserSession;
  let inoCounter = 3_000_000n;
  const series: Record<string, number> = {};
  const books: Record<string, number> = {};
  const paths: Record<string, string> = {};

  async function createSeries(key: string) {
    const name = `${TOKEN} ${key}`;
    const [row] = await ctx.db.insert(schema.bookSeries).values({ name, normalizedName: name.toLowerCase() }).returning({ id: schema.bookSeries.id });
    series[key] = row!.id;
  }

  async function seedBook(key: string, seriesKey: string, index: string, target: CreatedLibrary = library) {
    const folder = `${target.folderPath}/${key}-${randomUUID()}`;
    const [book] = await ctx.db
      .insert(schema.books)
      .values({ libraryId: target.libraryId, libraryFolderId: target.libraryFolderId, folderPath: folder, status: 'present' })
      .returning({ id: schema.books.id });
    const bookId = book!.id;
    await ctx.db.insert(schema.bookMetadata).values({ bookId, title: `${TOKEN} ${key}`, seriesId: series[seriesKey]!, seriesIndex: index });
    await ctx.db.insert(schema.bookSeriesMemberships).values({ bookId, seriesId: series[seriesKey]!, seriesIndex: index });
    inoCounter += 1n;
    const absolutePath = `${folder}/issue.cbz`;
    const [file] = await ctx.db
      .insert(schema.bookFiles)
      .values({
        bookId,
        libraryFolderId: target.libraryFolderId,
        absolutePath,
        relPath: `${key}/issue.cbz`,
        ino: inoCounter,
        format: 'cbz',
        role: 'content',
        sizeBytes: 2048,
        sortOrder: 0,
      })
      .returning({ id: schema.bookFiles.id });
    await ctx.db.update(schema.books).set({ primaryFileId: file!.id }).where(eq(schema.books.id, bookId));
    books[key] = bookId;
    paths[key] = absolutePath;
  }

  const chapter = (key: string, read = false, number?: number) => ({ url: `${KOMGA}/api/v1/books/K-${key}`, name: key, read, number });

  function backup(): Buffer {
    const mangas: MihonFixtureManga[] = [
      { url: `${KOMGA}/api/v1/series/unstarted`, title: 'Unstarted', chapters: [chapter('unstarted-1'), chapter('unstarted-2')] },
      // Issue 3 arrived after the migration snapshot, so it can only match by number.
      {
        url: `${KOMGA}/api/v1/series/partway`,
        title: 'Partway',
        chapters: [chapter('partway-1', true), chapter('partway-2', true), chapter('partway-3', false, 3)],
      },
      { url: `${KOMGA}/api/v1/series/finished`, title: 'Finished', chapters: [chapter('finished-1', true), chapter('finished-2', true)] },
      { url: `${KOMGA}/api/v1/series/tracked`, title: 'Tracked', komgaTrackerStatus: 3, chapters: [chapter('tracked-1')] },
      { url: `${KOMGA}/api/v1/series/dropped`, title: 'Dropped', chapters: [chapter('dropped-1')] },
      { url: `${KOMGA}/api/v1/series/history`, title: 'History only', inLibrary: false, chapters: [chapter('history-1')] },
      { url: `${KOMGA}/api/v1/series/elsewhere`, title: 'Not in BookOrbit', chapters: [chapter('missing-1', true)] },
      { url: `${KOMGA}/api/v1/series/private`, title: 'Private', chapters: [chapter('private-1', true)] },
    ];
    return encodeMihonBackup(mangas);
  }

  async function upload(apply: boolean, file = backup()) {
    const boundary = `----bookorbit-reader-import-${randomUUID()}`;
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="app.tachibk"\r\nContent-Type: application/octet-stream\r\n\r\n`,
      ),
      file,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return ctx.app.inject({
      method: 'POST',
      url: `/api/v1/reader-import/mihon${apply ? '?apply=true' : ''}`,
      headers: { ...authHeader(reader.accessToken), 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
  }

  async function upNextIds(): Promise<number[]> {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/dashboard/scrollers/batch',
      headers: authHeader(reader.accessToken),
      payload: { items: [{ id: 'up-next', type: 'up-next-in-series', limit: 50 }] },
    });
    expect(response.statusCode, response.body).toBe(200);
    return (response.json() as DashboardScrollerBatchResponse).items[0]!.books.map((book) => book.id);
  }

  async function readStatus(key: string) {
    const [row] = await ctx.db
      .select({ status: schema.userBookStatus.status })
      .from(schema.userBookStatus)
      .where(and(eq(schema.userBookStatus.userId, reader.userId), eq(schema.userBookStatus.bookId, books[key]!)));
    return row?.status ?? null;
  }

  async function followStatus(key: string) {
    const [row] = await ctx.db
      .select({ status: schema.userSeriesStatus.status })
      .from(schema.userSeriesStatus)
      .where(and(eq(schema.userSeriesStatus.userId, reader.userId), eq(schema.userSeriesStatus.seriesId, series[key]!)));
    return row?.status ?? null;
  }

  beforeAll(async () => {
    ctx = await createReaderStateIsolationE2EContext({ multipart: true });
    library = await createLibraryWithFolder(ctx, { name: `${TOKEN} Comics` });
    hidden = await createLibraryWithFolder(ctx, { name: `${TOKEN} Hidden` });
    reader = await createUserAndLogin(ctx);
    await grantLibraryAccess(ctx, reader.userId, library.libraryId);

    for (const key of ['unstarted', 'partway', 'finished', 'tracked', 'dropped', 'history', 'private']) await createSeries(key);
    await seedBook('unstarted-1', 'unstarted', '1');
    await seedBook('unstarted-2', 'unstarted', '2');
    for (const index of ['1', '2', '3', '4']) await seedBook(`partway-${index}`, 'partway', index);
    await seedBook('finished-1', 'finished', '1');
    await seedBook('finished-2', 'finished', '2');
    await seedBook('tracked-1', 'tracked', '1');
    await seedBook('dropped-1', 'dropped', '1');
    await seedBook('history-1', 'history', '1');
    await seedBook('private-1', 'private', '1', hidden);

    const snapshotKeys = Object.keys(paths).filter((key) => key !== 'partway-3');
    const [source] = await ctx.db
      .insert(schema.migrationSources)
      .values({ type: 'komga', name: `${TOKEN} Komga`, connectionConfig: {} })
      .returning({ id: schema.migrationSources.id });
    const [profile] = await ctx.db
      .insert(schema.migrationProfiles)
      .values({ sourceId: source!.id, name: `${TOKEN} profile`, userMappings: [] })
      .returning({ id: schema.migrationProfiles.id });
    await ctx.db.insert(schema.migrationPlanArtifacts).values({
      sourceId: source!.id,
      profileId: profile!.id,
      sourceSnapshotHash: TOKEN,
      profileHash: TOKEN,
      planHash: TOKEN,
      plan: { pathMappings: [] },
      summary: {},
      sourceData: { books: snapshotKeys.map((key) => ({ files: [{ sourceBookId: `K-${key}`, filePath: paths[key] }] })) },
    });

    await ctx.db.insert(schema.userBookStatus).values({ userId: reader.userId, bookId: books['partway-2']!, status: 'unread', source: 'manual' });

    expect(
      (
        await ctx.app.inject({
          method: 'PUT',
          url: `/api/v1/series/${series.dropped}/status`,
          headers: authHeader(reader.accessToken),
          payload: { status: 'dropped' },
        })
      ).statusCode,
    ).toBe(200);
  });

  afterAll(async () => {
    if (ctx) await closeReaderStateIsolationE2EContext(ctx);
  });

  it('previews without changing anything', async () => {
    const response = await upload(false);
    expect(response.statusCode, response.body).toBe(201);
    const result = response.json() as ReaderImportResult;

    expect(result).toMatchObject({ applied: false, libraryEntries: 7, skippedHistoryEntries: 1, booksToMarkRead: 3 });
    const byName = Object.fromEntries(result.series.map((item) => [item.seriesName.replace(`${TOKEN} `, ''), item]));
    expect(byName.unstarted).toMatchObject({ action: 'set', status: 'reading' });
    expect(byName.partway).toMatchObject({ action: 'set', status: 'reading', booksToMarkRead: 1 });
    expect(byName.finished).toMatchObject({ action: 'set', status: 'caught_up', booksToMarkRead: 2 });
    expect(byName.tracked).toMatchObject({ action: 'set', status: 'completed' });
    expect(byName.dropped).toMatchObject({ action: 'kept', status: 'dropped' });
    expect(byName.private).toBeUndefined();
    expect(result.numberMatches).toEqual([expect.objectContaining({ appTitle: 'Partway', seriesIndex: '3' })]);
    expect(result.unmatched.map((item) => item.appTitle)).toEqual(['Not in BookOrbit', 'Private']);

    expect(await readStatus('partway-1')).toBeNull();
    expect(await followStatus('unstarted')).toBeNull();
  });

  it('applies the plan so Up Next reflects the app library', async () => {
    expect(await upNextIds()).not.toContain(books['unstarted-1']);

    const response = await upload(true);
    expect(response.statusCode, response.body).toBe(201);
    expect((response.json() as ReaderImportResult).applied).toBe(true);

    for (const key of ['partway-1', 'finished-1', 'finished-2']) expect(await readStatus(key)).toBe('read');
    expect(await readStatus('partway-2')).toBe('unread');
    expect(await readStatus('partway-3')).toBeNull();
    expect(await readStatus('private-1')).toBeNull();
    expect(await followStatus('dropped')).toBe('dropped');

    const ids = await upNextIds();
    expect(ids).toContain(books['unstarted-1']);
    expect(ids).toContain(books['partway-2']);
    expect(ids).not.toContain(books['finished-2']);
    expect(ids).not.toContain(books['tracked-1']);
    expect(ids).not.toContain(books['dropped-1']);
    expect(ids).not.toContain(books['history-1']);
  });

  it('is safe to run again', async () => {
    const result = (await upload(true)).json() as ReaderImportResult;
    expect(result.booksToMarkRead).toBe(0);
    expect(result.series.every((item) => item.action === 'kept')).toBe(true);
  });

  it('rejects a file that is not a backup', async () => {
    const response = await upload(false, Buffer.from('title,author\nSupergirl,Sophie Campbell\n'));
    expect(response.statusCode).toBe(400);
  });
});
