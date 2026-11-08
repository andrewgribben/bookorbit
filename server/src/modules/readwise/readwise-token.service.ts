import { Injectable } from '@nestjs/common';

import { ReadingServiceTokenService } from '../reading-services/reading-service-token.service';
import { ReadwiseRepository } from './readwise.repository';

/**
 * Resolves a user's decrypted Readwise token.
 *
 * Kept separate from ReadwiseSettingsService on purpose: the settings service
 * depends on the auto-sync scheduler, which depends on the sync service, so
 * the sync service importing the settings service forms a module cycle that
 * crashes the compiled CommonJS build at startup.
 */
@Injectable()
export class ReadwiseTokenService {
  constructor(
    private readonly repo: ReadwiseRepository,
    private readonly tokenService: ReadingServiceTokenService,
  ) {}

  async getToken(userId: number): Promise<string | null> {
    const row = await this.repo.findSettings(userId);
    return this.tokenService.getToken(row, async (encrypted) => {
      await this.repo.upsertSettings(userId, { apiToken: null, apiTokenEncrypted: encrypted });
    });
  }
}
