import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { KomgaAuthGuard } from './komga-auth.guard';
import { KomgaCollectionService } from './komga-collection.service';
import { KomgaLibraryPageQueryDto } from './dto/komga-query.dto';

/** Read-only: BookOrbit has no series-set entity. */
@Controller('komga')
@Public()
@UseGuards(KomgaAuthGuard)
export class KomgaCollectionController {
  constructor(private readonly collectionService: KomgaCollectionService) {}

  @Get('api/v1/collections')
  listCollections(@CurrentUser() user: RequestUser, @Query() query: KomgaLibraryPageQueryDto) {
    return this.collectionService.listCollections(user, query);
  }

  @Get('api/v1/collections/:id')
  getCollection(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.collectionService.getCollection(user, id);
  }

  @Get('api/v1/collections/:id/thumbnail')
  async getCollectionThumbnail(@CurrentUser() user: RequestUser, @Param('id') id: string, @Res() reply: FastifyReply) {
    await this.collectionService.streamThumbnail(user, id, reply);
  }
}
