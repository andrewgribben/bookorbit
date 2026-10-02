import { Body, Controller, Get, Param, ParseIntPipe, Put, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { AudiobookFeedService } from './audiobook-feed.service';
import { ListAudiobookFeedCatalogDto } from './dto/list-audiobook-feed-catalog.dto';
import { SetAudiobookFeedDto } from './dto/set-audiobook-feed.dto';

@Controller('audiobook-feeds')
export class AudiobookFeedAdminController {
  constructor(private readonly service: AudiobookFeedService) {}

  @Get('catalog')
  listCatalog(@Query() query: ListAudiobookFeedCatalogDto, @CurrentUser() user: RequestUser) {
    return this.service.listCatalog(user, query);
  }

  @Put('books/:bookId')
  setFeed(@Param('bookId', ParseIntPipe) bookId: number, @Body() dto: SetAudiobookFeedDto, @CurrentUser() user: RequestUser) {
    return this.service.setFeedEnabled(bookId, dto.enabled, user);
  }
}
