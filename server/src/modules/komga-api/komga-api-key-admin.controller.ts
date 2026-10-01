import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { KomgaApiKeyService } from './komga-api-key.service';
import { maskApiKey } from './komga-api-key';

@Controller('user/api-keys')
export class KomgaApiKeyAdminController {
  constructor(private readonly apiKeyService: KomgaApiKeyService) {}

  @Get()
  async list(@CurrentUser() user: RequestUser) {
    const keys = await this.apiKeyService.listForUser(user.id);
    return keys.map((key) => ({
      id: key.id,
      label: key.label,
      keyPrefix: maskApiKey(key.keyPrefix),
      createdAt: key.createdAt.toISOString(),
      lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    }));
  }

  @Post()
  async create(@CurrentUser() user: RequestUser, @Body() body: { label: string }) {
    const created = await this.apiKeyService.create(user.id, body.label);
    return {
      id: created.id,
      label: created.label,
      key: created.key,
      keyPrefix: maskApiKey(created.keyPrefix),
      createdAt: created.createdAt.toISOString(),
    };
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.apiKeyService.revoke(user.id, id);
  }
}
