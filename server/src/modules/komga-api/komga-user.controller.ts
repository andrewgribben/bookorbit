import { Controller, Delete, Get, HttpCode, Param, Post, Body, UseGuards } from '@nestjs/common';

import { Permission } from '@bookorbit/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PermissionService } from '../../common/services/permission.service';
import type { RequestUser } from '../../common/types/request-user';
import { LibraryService } from '../library/library.service';
import { KomgaApiKeyService } from './komga-api-key.service';
import { maskApiKey } from './komga-api-key';
import { KomgaAuthGuard } from './komga-auth.guard';
import { decodeKomgaId } from './komga-ids';
import { toKomgaApiKey, toKomgaUser } from './komga.mappers';
import { KomgaApiKeyRequestDto } from './dto/komga-query.dto';

@Controller('komga')
@Public()
@UseGuards(KomgaAuthGuard)
export class KomgaUserController {
  constructor(
    private readonly libraryService: LibraryService,
    private readonly permissionService: PermissionService,
    private readonly apiKeyService: KomgaApiKeyService,
  ) {}

  @Get('api/v2/users/me')
  async getCurrentUser(@CurrentUser() user: RequestUser) {
    const libraryIds = await this.libraryService.findAccessibleLibraryIds(user);
    return toKomgaUser(user, libraryIds, this.permissionService.userHas(user, Permission.LibraryDownload));
  }

  @Get('api/v2/users/me/api-keys')
  async listApiKeys(@CurrentUser() user: RequestUser) {
    const keys = await this.apiKeyService.listForUser(user.id);
    return keys.map((key) => toKomgaApiKey(key.id, key.userId, key.label, key.createdAt.toISOString(), maskApiKey(key.keyPrefix)));
  }

  @Post('api/v2/users/me/api-keys')
  @HttpCode(200)
  async createApiKey(@CurrentUser() user: RequestUser, @Body() dto: KomgaApiKeyRequestDto) {
    const created = await this.apiKeyService.create(user.id, dto.comment);
    return toKomgaApiKey(created.id, created.userId, created.label, created.createdAt.toISOString(), created.key);
  }

  @Delete('api/v2/users/me/api-keys/:keyId')
  @HttpCode(204)
  async revokeApiKey(@CurrentUser() user: RequestUser, @Param('keyId') keyId: string): Promise<void> {
    await this.apiKeyService.revoke(user.id, decodeKomgaId(keyId, 'api key'));
  }
}
