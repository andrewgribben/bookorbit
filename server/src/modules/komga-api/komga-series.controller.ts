import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { SeriesService } from '../series/series.service';
import { KomgaAuthGuard } from './komga-auth.guard';
import { KomgaEnabledGuard } from './komga-enabled.guard';
import { decodeKomgaId, toKomgaPage } from './komga-ids';
import { KomgaBookQueryService } from './komga-book-query.service';
import { KomgaBookService } from './komga-book.service';
import { KomgaSeriesService } from './komga-series.service';
import { KomgaBookQueryDto, KomgaSearchBodyDto, KomgaSeriesQueryDto, mergeKomgaSearchQuery } from './dto/komga-query.dto';

@Controller('komga')
@Public()
@UseGuards(KomgaEnabledGuard, KomgaAuthGuard)
export class KomgaSeriesController {
  constructor(
    private readonly komgaSeriesService: KomgaSeriesService,
    private readonly seriesService: SeriesService,
    private readonly komgaBookService: KomgaBookService,
    private readonly queryService: KomgaBookQueryService,
  ) {}

  @Get('api/v1/series')
  listSeries(@CurrentUser() user: RequestUser, @Query() query: KomgaSeriesQueryDto) {
    return this.komgaSeriesService.listSeries(user, query);
  }

  @Get('api/v1/series/latest')
  listLatestSeries(@CurrentUser() user: RequestUser, @Query() query: KomgaSeriesQueryDto) {
    return this.komgaSeriesService.listLatest(user, query);
  }

  @Get('api/v1/series/new')
  listNewSeries(@CurrentUser() user: RequestUser, @Query() query: KomgaSeriesQueryDto) {
    return this.komgaSeriesService.listLatest(user, query);
  }

  @Get('api/v1/series/updated')
  listUpdatedSeries(@CurrentUser() user: RequestUser, @Query() query: KomgaSeriesQueryDto) {
    return this.komgaSeriesService.listLatest(user, query);
  }

  @Post('api/v1/series/list')
  @HttpCode(200)
  listSeriesBySearch(@CurrentUser() user: RequestUser, @Query() query: KomgaSeriesQueryDto, @Body() body: KomgaSearchBodyDto) {
    const merged = mergeKomgaSearchQuery(query, body);
    return this.komgaSeriesService.listSeries(user, {
      ...merged,
      search: body.fullTextSearch ?? query.search,
      condition: body.condition,
    });
  }

  @Get('api/v1/series/:seriesId')
  getSeries(@CurrentUser() user: RequestUser, @Param('seriesId') seriesId: string) {
    return this.komgaSeriesService.getSeries(user, seriesId);
  }

  @Get('api/v1/series/:seriesId/books')
  async listSeriesBooks(@CurrentUser() user: RequestUser, @Param('seriesId') seriesId: string, @Query() query: KomgaBookQueryDto) {
    const dto = this.queryService.toSeriesBooksDto(query);
    const page = await this.seriesService.findBooks(user, decodeKomgaId(seriesId, 'series'), dto);
    const items = await this.komgaBookService.toKomgaBooks(user, page.items);

    return toKomgaPage(items, page.total, page.page, page.size, true);
  }

  @Get('api/v1/series/:seriesId/thumbnail')
  async getSeriesThumbnail(@CurrentUser() user: RequestUser, @Param('seriesId') seriesId: string, @Res() reply: FastifyReply) {
    await this.komgaSeriesService.streamThumbnail(user, seriesId, reply);
  }

  @Get('api/v1/series/:seriesId/collections')
  getSeriesCollections(@CurrentUser() user: RequestUser, @Param('seriesId') seriesId: string) {
    return this.komgaSeriesService.listCollectionsForSeries(user, seriesId);
  }

  @Post('api/v1/series/:seriesId/read-progress')
  @HttpCode(204)
  async markSeriesRead(@CurrentUser() user: RequestUser, @Param('seriesId') seriesId: string): Promise<void> {
    await this.komgaSeriesService.setSeriesReadProgress(user, seriesId);
  }

  @Delete('api/v1/series/:seriesId/read-progress')
  @HttpCode(204)
  async clearSeriesReadProgress(@CurrentUser() user: RequestUser, @Param('seriesId') seriesId: string): Promise<void> {
    await this.komgaSeriesService.clearSeriesReadProgress(user, seriesId);
  }
}
