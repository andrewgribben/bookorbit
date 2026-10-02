import { Controller, Delete, Get, HttpCode, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { LibraryService } from '../library/library.service';
import { KomgaAuthGuard } from './komga-auth.guard';
import { KomgaEnabledGuard } from './komga-enabled.guard';
import { toKomgaLibrary } from './komga.mappers';

@Controller('komga')
@Public()
@UseGuards(KomgaEnabledGuard, KomgaAuthGuard)
export class KomgaLibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get('api/v1/libraries')
  async listLibraries(@CurrentUser() user: RequestUser) {
    const libraries = await this.libraryService.findAll(user);
    return libraries.map((library) => toKomgaLibrary(library));
  }

  /** BookOrbit keeps no Komga sync points. */
  @Delete('api/v1/syncpoints/me')
  @HttpCode(204)
  clearSyncPoints(): void {}
}
