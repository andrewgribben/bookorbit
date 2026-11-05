import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';

import { AuditAction, AuditResource, Permission } from '@bookorbit/types';

import { Auditable } from '../../common/decorators/auditable.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ForbidPermission } from '../../common/decorators/forbid-permission.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { FindNextSeriesBookDto } from './dto/find-next-series-book.dto';
import { ListSeriesBooksDto } from './dto/list-series-books.dto';
import { ListSeriesDto } from './dto/list-series.dto';
import { MarkSeriesReadDto } from './dto/mark-series-read.dto';
import { MarkSeriesUnreadDto } from './dto/mark-series-unread.dto';
import { SetSeriesFollowStatusDto } from './dto/set-series-follow-status.dto';
import { SeriesService } from './series.service';

@Controller('series')
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  @Get()
  findAll(@CurrentUser() user: RequestUser, @Query() dto: ListSeriesDto) {
    return this.seriesService.findAll(user, dto);
  }

  @Put(':seriesId/status')
  setFollowStatus(@CurrentUser() user: RequestUser, @Param('seriesId', ParseIntPipe) seriesId: number, @Body() dto: SetSeriesFollowStatusDto) {
    return this.seriesService.setFollowStatus(user, seriesId, dto);
  }

  @Delete(':seriesId/status')
  @HttpCode(HttpStatus.NO_CONTENT)
  clearFollowStatus(@CurrentUser() user: RequestUser, @Param('seriesId', ParseIntPipe) seriesId: number) {
    return this.seriesService.clearFollowStatus(user, seriesId);
  }

  @Post(':seriesId/mark-read')
  @ForbidPermission(Permission.DemoRestricted, 'Demo-restricted account cannot perform bulk edits')
  @Auditable({
    action: AuditAction.BookBulkSetStatus,
    resource: AuditResource.Book,
    description: (req) => {
      const body = req.body as { upToBookId?: number };
      return body?.upToBookId ? `Mark series books read up to book ${body.upToBookId}` : 'Mark all series books read';
    },
  })
  markRead(@CurrentUser() user: RequestUser, @Param('seriesId', ParseIntPipe) seriesId: number, @Body() dto: MarkSeriesReadDto) {
    return this.seriesService.markRead(user, seriesId, dto);
  }

  @Post(':seriesId/mark-unread')
  @ForbidPermission(Permission.DemoRestricted, 'Demo-restricted account cannot perform bulk edits')
  @Auditable({
    action: AuditAction.BookBulkSetStatus,
    resource: AuditResource.Book,
    description: (req) => `Mark series books unread from book ${(req.body as { fromBookId?: number })?.fromBookId}`,
  })
  markUnread(@CurrentUser() user: RequestUser, @Param('seriesId', ParseIntPipe) seriesId: number, @Body() dto: MarkSeriesUnreadDto) {
    return this.seriesService.markUnread(user, seriesId, dto);
  }

  @Get(':seriesId/books')
  findBooks(@CurrentUser() user: RequestUser, @Param('seriesId', ParseIntPipe) seriesId: number, @Query() dto: ListSeriesBooksDto) {
    return this.seriesService.findBooks(user, seriesId, dto);
  }

  @Get(':seriesId/books/:bookId/next')
  findNextBook(
    @CurrentUser() user: RequestUser,
    @Param('seriesId', ParseIntPipe) seriesId: number,
    @Param('bookId', ParseIntPipe) bookId: number,
    @Query() dto: FindNextSeriesBookDto,
  ) {
    return this.seriesService.findNextBook(user, seriesId, bookId, dto);
  }
}
