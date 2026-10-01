import { Controller, Get, Headers, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { Public } from '../../common/decorators/public.decorator';
import { AudiobookFeedService } from './audiobook-feed.service';

@Controller('feeds')
@Public()
export class AudiobookFeedPublicController {
  constructor(private readonly service: AudiobookFeedService) {}

  @Get(':publicId')
  getFeed(@Param('publicId', ParseUUIDPipe) publicId: string, @Res() reply: FastifyReply) {
    return this.service.writeRss(publicId, reply);
  }

  @Get(':publicId/cover')
  getCover(@Param('publicId', ParseUUIDPipe) publicId: string, @Res() reply: FastifyReply) {
    return this.service.streamCover(publicId, reply);
  }

  @Get(':publicId/items/:filePublicId')
  getItem(
    @Param('publicId', ParseUUIDPipe) publicId: string,
    @Param('filePublicId', ParseUUIDPipe) filePublicId: string,
    @Headers('range') rangeHeader: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    return this.service.streamItem(publicId, filePublicId, rangeHeader, reply);
  }
}
