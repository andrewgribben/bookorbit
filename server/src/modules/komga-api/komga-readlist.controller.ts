import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { KomgaAuthGuard } from './komga-auth.guard';
import { KomgaEnabledGuard } from './komga-enabled.guard';
import { KomgaReadListService } from './komga-readlist.service';
import { KomgaLibraryPageQueryDto, KomgaReadListWriteDto } from './dto/komga-query.dto';

/** Komga readlists map directly onto BookOrbit collections: user-scoped, ordered sets of books. */
@Controller('komga')
@Public()
@UseGuards(KomgaEnabledGuard, KomgaAuthGuard)
export class KomgaReadListController {
  constructor(private readonly readListService: KomgaReadListService) {}

  @Get('api/v1/readlists')
  listReadLists(@CurrentUser() user: RequestUser, @Query() query: KomgaLibraryPageQueryDto) {
    return this.readListService.listReadLists(user, query);
  }

  @Post('api/v1/readlists')
  @HttpCode(200)
  createReadList(@CurrentUser() user: RequestUser, @Body() dto: KomgaReadListWriteDto) {
    return this.readListService.createReadList(user, dto);
  }

  @Get('api/v1/readlists/:id')
  getReadList(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.readListService.getReadList(user, id);
  }

  @Patch('api/v1/readlists/:id')
  @HttpCode(204)
  async updateReadList(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: KomgaReadListWriteDto): Promise<void> {
    await this.readListService.updateReadList(user, id, dto);
  }

  @Delete('api/v1/readlists/:id')
  @HttpCode(204)
  async deleteReadList(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<void> {
    await this.readListService.deleteReadList(user, id);
  }

  @Get('api/v1/readlists/:id/books')
  listReadListBooks(@CurrentUser() user: RequestUser, @Param('id') id: string, @Query() query: KomgaLibraryPageQueryDto) {
    return this.readListService.listBooks(user, id, query);
  }

  @Get('api/v1/readlists/:id/thumbnail')
  async getReadListThumbnail(@CurrentUser() user: RequestUser, @Param('id') id: string, @Res() reply: FastifyReply) {
    await this.readListService.streamThumbnail(user, id, reply);
  }
}
