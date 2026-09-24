import { BadRequestException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { EMPTY_CONTENT_FILTER_RULES, Permission } from '@bookorbit/types';
import { GlobalExceptionFilter } from '../../common/filters/http-exception.filter';
import type { RequestUser } from '../../common/types/request-user';
import { KomgaApiKeyService } from './komga-api-key.service';
import { KomgaAuthGuard } from './komga-auth.guard';
import { KomgaBookController } from './komga-book.controller';
import { KomgaBookQueryService } from './komga-book-query.service';
import { KomgaBookService } from './komga-book.service';
import { KomgaCollectionController } from './komga-collection.controller';
import { KomgaCollectionService } from './komga-collection.service';
import { KomgaLibraryController } from './komga-library.controller';
import { KomgaReadListController } from './komga-readlist.controller';
import { KomgaReadListService } from './komga-readlist.service';
import { KomgaSeriesController } from './komga-series.controller';
import { KomgaSeriesService } from './komga-series.service';
import { KomgaSessionService } from './komga-session.service';
import { KomgaUserController } from './komga-user.controller';
import { LibraryService } from '../library/library.service';
import { PermissionService } from '../../common/services/permission.service';
import { SeriesService } from '../series/series.service';

const USER = {
  id: 7,
  username: 'reader',
  name: 'Reader',
  email: 'reader@example.com',
  active: true,
  isSuperuser: false,
  isDefaultPassword: false,
  tokenVersion: 1,
  settings: {},
  avatarUrl: null,
  provisioningMethod: 'local',
  permissions: [Permission.LibraryDownload],
  contentFilters: EMPTY_CONTENT_FILTER_RULES,
} as unknown as RequestUser;

describe('Komga HTTP surface', () => {
  let app: NestFastifyApplication;

  const komgaBookService = {
    getBook: vi.fn(),
    getNeighbour: vi.fn(),
    listPages: vi.fn(),
    downloadFile: vi.fn(),
    downloadThumbnail: vi.fn(),
    downloadCover: vi.fn(),
    toKomgaBooks: vi.fn(),
    saveReadProgress: vi.fn(),
    clearReadProgress: vi.fn(),
    getManifest: vi.fn(),
    getPositions: vi.fn(),
    getProgression: vi.fn(),
    saveProgression: vi.fn(),
  };
  const komgaBookQueryService = { queryBooks: vi.fn(), listLatest: vi.fn(), listOnDeck: vi.fn() };
  const komgaSeriesService = {
    listSeries: vi.fn(),
    listLatest: vi.fn(),
    getSeries: vi.fn(),
    streamThumbnail: vi.fn(),
    listCollectionsForSeries: vi.fn(),
    setSeriesReadProgress: vi.fn(),
    clearSeriesReadProgress: vi.fn(),
  };
  const komgaCollectionService = { listCollections: vi.fn(), getCollection: vi.fn(), streamThumbnail: vi.fn() };
  const komgaReadListService = {
    listReadLists: vi.fn(),
    createReadList: vi.fn(),
    getReadList: vi.fn(),
    updateReadList: vi.fn(),
    deleteReadList: vi.fn(),
    listBooks: vi.fn(),
    listReadListsForBook: vi.fn(),
    streamThumbnail: vi.fn(),
  };
  const komgaApiKeyService = { listForUser: vi.fn(), create: vi.fn(), revoke: vi.fn() };
  const komgaSessionService = { create: vi.fn(), resolve: vi.fn(), isValidToken: vi.fn() };
  const libraryService = { findAll: vi.fn(), findAccessibleLibraryIds: vi.fn() };
  const permissionService = { userHas: vi.fn() };
  const seriesService = { findBooks: vi.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        KomgaUserController,
        KomgaLibraryController,
        KomgaSeriesController,
        KomgaBookController,
        KomgaCollectionController,
        KomgaReadListController,
      ],
      providers: [
        { provide: KomgaBookService, useValue: komgaBookService },
        { provide: KomgaBookQueryService, useValue: komgaBookQueryService },
        { provide: KomgaSeriesService, useValue: komgaSeriesService },
        { provide: KomgaCollectionService, useValue: komgaCollectionService },
        { provide: KomgaReadListService, useValue: komgaReadListService },
        { provide: KomgaApiKeyService, useValue: komgaApiKeyService },
        { provide: KomgaSessionService, useValue: komgaSessionService },
        { provide: LibraryService, useValue: libraryService },
        { provide: PermissionService, useValue: permissionService },
        { provide: SeriesService, useValue: seriesService },
      ],
    })
      .overrideGuard(KomgaAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: RequestUser } } }) => {
          context.switchToHttp().getRequest().user = USER;
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api/v1', { exclude: ['komga/(.*)'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    libraryService.findAccessibleLibraryIds.mockResolvedValue([1]);
    permissionService.userHas.mockReturnValue(true);
    libraryService.findAll.mockResolvedValue([
      {
        id: 1,
        name: 'Comics',
        folders: [{ path: '/srv/comics' }],
        allowedFormats: ['cbz'],
        excludePatterns: [],
      },
    ]);
  });

  it('serves the documented Komga path beneath the mount point', async () => {
    komgaSeriesService.listSeries.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, first: true, last: true });

    const response = await app.inject({ method: 'GET', url: '/komga/api/v1/series' });

    expect(response.statusCode).toBe(200);
    expect(komgaSeriesService.listSeries).toHaveBeenCalledWith(USER, expect.objectContaining({}));
  });

  it('maps libraries through the real mapper', async () => {
    const response = await app.inject({ method: 'GET', url: '/komga/api/v1/libraries' });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { id: string; name: string; root: string; scanCbx: boolean; scanEpub: boolean }[];
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: '1', name: 'Comics', root: '/srv/comics', scanCbx: true, scanEpub: false });
  });

  it('reports the authenticated account', async () => {
    const response = await app.inject({ method: 'GET', url: '/komga/api/v2/users/me' });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { id: string; roles: string[]; sharedLibrariesIds: string[] };
    expect(body.id).toBe('7');
    expect(body.roles).toContain('FILE_DOWNLOAD');
    expect(body.sharedLibrariesIds).toEqual(['1']);
  });

  it('rejects a condition tree with 400 instead of answering with the whole library', async () => {
    komgaBookQueryService.queryBooks.mockRejectedValue(new BadRequestException('search conditions are not supported yet'));

    const response = await app.inject({
      method: 'POST',
      url: '/komga/api/v1/books/list',
      payload: { condition: { title: { operator: 'is', value: 'x' } } },
    });

    expect(response.statusCode).toBe(400);
  });

  it('validates query parameter types before the service sees them', async () => {
    const response = await app.inject({ method: 'GET', url: '/komga/api/v1/series?page=abc' });

    expect(response.statusCode).toBe(400);
    expect(komgaSeriesService.listSeries).not.toHaveBeenCalled();
  });

  it('accepts documented filters it ignores and rejects parameters Komga does not define', async () => {
    komgaSeriesService.listSeries.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, first: true, last: true });

    const accepted = await app.inject({ method: 'GET', url: '/komga/api/v1/series?status=ONGOING&genre=Action&complete=false' });
    expect(accepted.statusCode).toBe(200);

    const rejected = await app.inject({ method: 'GET', url: '/komga/api/v1/series?notAKomgaParameter=1' });
    expect(rejected.statusCode).toBe(400);
  });

  it('forwards a numeric size and page to the query service', async () => {
    komgaBookQueryService.queryBooks.mockResolvedValue({ items: [], total: 0, page: 3, size: 10 });
    komgaBookService.toKomgaBooks.mockResolvedValue([]);

    const response = await app.inject({ method: 'POST', url: '/komga/api/v1/books/list?page=3&size=10', payload: {} });

    expect(response.statusCode).toBe(200);
    expect(komgaBookQueryService.queryBooks).toHaveBeenCalledWith(USER, expect.objectContaining({ page: 3, size: 10 }));
    expect(response.json()).toMatchObject({ totalElements: 0, number: 3, pageable: { pageNumber: 3, pageSize: 10 } });
  });

  it('maps a missing resource to 404 and a bad id to 400', async () => {
    komgaBookService.getBook.mockRejectedValue(new NotFoundException('Unknown book: 999'));

    const missing = await app.inject({ method: 'GET', url: '/komga/api/v1/books/999' });
    expect(missing.statusCode).toBe(404);

    komgaBookService.getBook.mockRejectedValue(new BadRequestException('Invalid book id'));
    const malformed = await app.inject({ method: 'GET', url: '/komga/api/v1/books/not-a-number' });
    expect(malformed.statusCode).toBe(400);
  });

  it('returns the page list as a bare array, the shape Komga documents', async () => {
    komgaBookService.listPages.mockResolvedValue([{ fileName: '001.png', mediaType: 'image/png', number: 1, size: '10', sizeBytes: 10 }]);

    const response = await app.inject({ method: 'GET', url: '/komga/api/v1/books/12/pages' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ fileName: '001.png', mediaType: 'image/png', number: 1, size: '10', sizeBytes: 10 }]);
  });

  it('persists a progression write and rejects one without a locator', async () => {
    const ok = await app.inject({
      method: 'PUT',
      url: '/komga/api/v1/books/12/progression',
      payload: { device: { id: 'd', name: 'Panels' }, locator: { href: '/pages/3', type: 'image/png' }, modified: '2026-09-19T10:00:00.000Z' },
    });

    expect(ok.statusCode).toBe(204);
    expect(komgaBookService.saveProgression).toHaveBeenCalledWith(USER, '12', expect.objectContaining({ locator: expect.anything() }));

    const invalid = await app.inject({ method: 'PUT', url: '/komga/api/v1/books/12/progression', payload: {} });
    expect(invalid.statusCode).toBe(400);
  });

  it('answers the syncpoints reset with 204 and no body', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/komga/api/v1/syncpoints/me' });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');
  });

  it('reports readlist creation and deletion through their Komga shapes', async () => {
    komgaReadListService.createReadList.mockResolvedValue({
      bookIds: [],
      createdDate: '2026-09-19T10:00:00.000Z',
      filtered: false,
      id: '44',
      lastModifiedDate: '2026-09-19T10:00:00.000Z',
      name: 'Order',
      ordered: true,
      summary: '',
    });

    const created = await app.inject({ method: 'POST', url: '/komga/api/v1/readlists', payload: { name: 'Order', bookIds: [] } });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toMatchObject({ id: '44', ordered: true });

    const deleted = await app.inject({ method: 'DELETE', url: '/komga/api/v1/readlists/44' });
    expect(deleted.statusCode).toBe(204);
    expect(komgaReadListService.deleteReadList).toHaveBeenCalledWith(USER, '44');
  });

  it('serves a series thumbnail through the reply object', async () => {
    komgaSeriesService.streamThumbnail.mockImplementation(
      (_user: RequestUser, _id: string, reply: { type: (value: string) => void; send: (value: unknown) => void }) => {
        reply.type('image/jpeg');
        reply.send(Buffer.from('thumbnail'));
        return Promise.resolve();
      },
    );

    const response = await app.inject({ method: 'GET', url: '/komga/api/v1/series/91/thumbnail' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('image/jpeg');
  });
});
