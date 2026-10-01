import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { KomgaAuthGuard } from './komga-auth.guard';
import { toKomgaPage } from './komga-ids';
import { KomgaBookQueryService } from './komga-book-query.service';
import { KomgaBookService } from './komga-book.service';
import { KomgaReadListService } from './komga-readlist.service';
import { KomgaBookQueryDto, KomgaProgressionDto, KomgaReadProgressUpdateDto, KomgaSearchBodyDto, mergeKomgaSearchQuery } from './dto/komga-query.dto';

/** `entryPath` arrives percent-encoded and without a leading slash; entries are plain file paths. */
function decodeResourcePath(encodedPath: string): string {
  try {
    return encodedPath
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/');
  } catch {
    throw new BadRequestException('Invalid resource path');
  }
}

/** Static segments before :bookId or Nest captures them as the id. */
@Controller('komga')
@Public()
@UseGuards(KomgaAuthGuard)
export class KomgaBookController {
  constructor(
    private readonly bookService: KomgaBookService,
    private readonly queryService: KomgaBookQueryService,
    private readonly readListService: KomgaReadListService,
  ) {}

  @Post('api/v1/books/list')
  @HttpCode(200)
  async listBooks(@CurrentUser() user: RequestUser, @Query() query: KomgaBookQueryDto, @Body() body: KomgaSearchBodyDto) {
    const merged = { ...mergeKomgaSearchQuery(query, body), condition: body.condition, fullTextSearch: body.fullTextSearch };
    const page = await this.queryService.queryBooks(user, merged);
    const items = await this.bookService.toKomgaBooks(user, page.items);
    return toKomgaPage(items, page.total, page.page, page.size, true, merged.unpaged === true);
  }

  @Get('api/v1/books/latest')
  async listLatestBooks(@CurrentUser() user: RequestUser, @Query() query: KomgaBookQueryDto) {
    const page = await this.queryService.listLatest(user, query);
    const items = await this.bookService.toKomgaBooks(user, page.items);
    return toKomgaPage(items, page.total, page.page, page.size, true, query.unpaged === true);
  }

  @Get('api/v1/books/ondeck')
  async listOnDeckBooks(@CurrentUser() user: RequestUser, @Query() query: KomgaBookQueryDto) {
    const page = await this.queryService.listOnDeck(user, query);
    const items = await this.bookService.toKomgaBooks(user, page.items);
    return toKomgaPage(items, page.total, page.page, page.size, true, query.unpaged === true);
  }

  @Get('api/v1/books/:bookId')
  getBook(@CurrentUser() user: RequestUser, @Param('bookId') bookId: string) {
    return this.bookService.getBook(user, bookId);
  }

  @Get('api/v1/books/:bookId/next')
  getNextBook(@CurrentUser() user: RequestUser, @Param('bookId') bookId: string) {
    return this.bookService.getNeighbour(user, bookId, 'next');
  }

  @Get('api/v1/books/:bookId/previous')
  getPreviousBook(@CurrentUser() user: RequestUser, @Param('bookId') bookId: string) {
    return this.bookService.getNeighbour(user, bookId, 'previous');
  }

  @Get('api/v1/books/:bookId/thumbnail')
  async getBookThumbnail(@CurrentUser() user: RequestUser, @Param('bookId') bookId: string, @Res() reply: FastifyReply) {
    await this.bookService.downloadThumbnail(user, bookId, reply);
  }

  @Get('api/v1/books/:bookId/file')
  async getBookFile(
    @CurrentUser() user: RequestUser,
    @Param('bookId') bookId: string,
    @Headers('range') rangeHeader: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    await this.bookService.downloadFile(user, bookId, rangeHeader, reply);
  }

  @Get('api/v1/books/:bookId/pages')
  getBookPages(@CurrentUser() user: RequestUser, @Param('bookId') bookId: string) {
    return this.bookService.listPages(user, bookId);
  }

  @Get('api/v1/books/:bookId/pages/:pageNumber')
  async getBookPage(
    @CurrentUser() user: RequestUser,
    @Param('bookId') bookId: string,
    @Param('pageNumber', ParseIntPipe) pageNumber: number,
    @Res() reply: FastifyReply,
  ) {
    await this.bookService.streamPage(user, bookId, pageNumber, reply);
  }

  /** BookOrbit does not generate page-level thumbnails, so the page image itself is returned. */
  @Get('api/v1/books/:bookId/pages/:pageNumber/thumbnail')
  async getBookPageThumbnail(
    @CurrentUser() user: RequestUser,
    @Param('bookId') bookId: string,
    @Param('pageNumber', ParseIntPipe) pageNumber: number,
    @Res() reply: FastifyReply,
  ) {
    await this.bookService.streamPage(user, bookId, pageNumber, reply);
  }

  @Patch('api/v1/books/:bookId/read-progress')
  @HttpCode(204)
  async updateReadProgress(
    @CurrentUser() user: RequestUser,
    @Param('bookId') bookId: string,
    @Body() dto: KomgaReadProgressUpdateDto,
  ): Promise<void> {
    await this.bookService.saveReadProgress(user, bookId, dto);
  }

  @Delete('api/v1/books/:bookId/read-progress')
  @HttpCode(204)
  async clearReadProgress(@CurrentUser() user: RequestUser, @Param('bookId') bookId: string): Promise<void> {
    await this.bookService.clearReadProgress(user, bookId);
  }

  @Get('api/v1/books/:bookId/readlists')
  listReadListsForBook(@CurrentUser() user: RequestUser, @Param('bookId') bookId: string) {
    return this.readListService.listReadListsForBook(user, bookId);
  }

  @Get('api/v1/books/:bookId/manifest')
  async getManifest(@CurrentUser() user: RequestUser, @Param('bookId') bookId: string, @Res() reply: FastifyReply) {
    const { contentType, manifest } = await this.bookService.getManifest(user, bookId);
    reply.type(contentType);
    reply.send(manifest);
  }

  @Get('api/v1/books/:bookId/manifest/epub')
  async getEpubManifest(@CurrentUser() user: RequestUser, @Param('bookId') bookId: string, @Res() reply: FastifyReply) {
    const { contentType, manifest } = await this.bookService.getEpubManifest(user, bookId);
    reply.type(contentType);
    reply.send(manifest);
  }

  @Get('api/v1/books/:bookId/manifest/divina')
  async getDivinaManifest(@CurrentUser() user: RequestUser, @Param('bookId') bookId: string, @Res() reply: FastifyReply) {
    const { contentType, manifest } = await this.bookService.getDivinaManifest(user, bookId);
    reply.type(contentType);
    reply.send(manifest);
  }

  /** Komga serves EPUB entries here; the path is the entry's path inside the container. */
  @Get('api/v1/books/:bookId/resource/*')
  async getBookResource(@CurrentUser() user: RequestUser, @Param('bookId') bookId: string, @Param('*') resource: string, @Res() reply: FastifyReply) {
    await this.bookService.streamResource(user, bookId, decodeResourcePath(resource), reply);
  }

  @Get('api/v1/books/:bookId/positions')
  getPositions(@CurrentUser() user: RequestUser, @Param('bookId') bookId: string) {
    return this.bookService.getPositions(user, bookId);
  }

  @Get('api/v1/books/:bookId/progression')
  getProgression(@CurrentUser() user: RequestUser, @Param('bookId') bookId: string) {
    return this.bookService.getProgression(user, bookId);
  }

  @Put('api/v1/books/:bookId/progression')
  @HttpCode(204)
  async updateProgression(@CurrentUser() user: RequestUser, @Param('bookId') bookId: string, @Body() dto: KomgaProgressionDto): Promise<void> {
    await this.bookService.saveProgression(user, bookId, dto);
  }
}
