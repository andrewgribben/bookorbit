import { BadRequestException, Injectable } from '@nestjs/common';

import type { ReadwiseSettings, ReadwiseSyncDisabledReason, ReadwiseTokenValidationResult, UpsertReadwiseSettingsPayload } from '@bookorbit/types';

import { ReadingServiceTokenService } from '../reading-services/reading-service-token.service';
import type { ReadwiseUserSetting } from '../../db/schema';
import { ReadwiseAutoSyncSchedulerService } from './readwise-auto-sync-scheduler.service';
import { ReadwiseClientService } from './readwise-client.service';
import { ReadwiseRepository } from './readwise.repository';

@Injectable()
export class ReadwiseSettingsService {
  constructor(
    private readonly repo: ReadwiseRepository,
    private readonly client: ReadwiseClientService,
    private readonly scheduler: ReadwiseAutoSyncSchedulerService,
    private readonly tokenService: ReadingServiceTokenService,
  ) {}

  /** The only path that should read a user's Readwise token; migrates legacy plaintext lazily. */
  async getToken(userId: number): Promise<string | null> {
    const row = await this.repo.findSettings(userId);
    return this.tokenService.getToken(row, async (encrypted) => {
      await this.repo.upsertSettings(userId, { apiToken: null, apiTokenEncrypted: encrypted });
    });
  }

  async getSettings(userId: number): Promise<ReadwiseSettings> {
    const [row, hasPermission] = await Promise.all([this.repo.findSettings(userId), this.repo.userHasReadwiseSyncPermission(userId)]);
    const tokenConfigured = Boolean(row?.apiToken || row?.apiTokenEncrypted);
    const enabled = row?.enabled ?? false;

    return {
      tokenConfigured,
      enabled,
      effectiveEnabled: hasPermission && tokenConfigured && enabled,
      // Prefer a stored auto-disable reason (e.g. bad token) over the derived one,
      // so the UI can distinguish "we disabled you" from "you turned it off".
      disabledReason:
        (row?.disabledReason as ReadwiseSyncDisabledReason | null | undefined) ??
        this.resolveDisabledReason({ hasPermission, tokenConfigured, enabled }),
      lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
    };
  }

  async upsertSettings(userId: number, payload: UpsertReadwiseSettingsPayload): Promise<ReadwiseSettings> {
    const existing = await this.repo.findSettings(userId);
    const rawToken = payload.apiToken !== undefined ? payload.apiToken.trim() : undefined;
    if (!existing?.apiToken && !existing?.apiTokenEncrypted && !rawToken) {
      throw new BadRequestException('API token is required to connect Readwise');
    }
    const data: Parameters<ReadwiseRepository['upsertSettings']>[1] = {};
    if (rawToken) {
      // Encrypt immediately on write when a key is configured, rather than waiting for the
      // lazy migrate-on-read path, so a freshly entered token is never persisted in plaintext.
      if (this.tokenService.isConfigured()) {
        data.apiTokenEncrypted = this.tokenService.encrypt(rawToken);
        data.apiToken = null;
      } else {
        data.apiToken = rawToken;
      }
      data.disabledReason = null; // clear auto-disable reason on new token
    }
    if (payload.enabled !== undefined) {
      data.enabled = payload.enabled;
      if (payload.enabled) data.disabledReason = null; // user re-enabling clears stored reason
    }
    if (this.shouldSeedWatermark(existing, rawToken, payload)) {
      data.lastSyncedAnnotationId = await this.repo.findLatestAnnotationId(userId);
    }
    await this.repo.upsertSettings(userId, data);
    const settings = await this.getSettings(userId);
    if (settings.effectiveEnabled) this.scheduler.requestSync(userId);
    return settings;
  }

  async validateToken(userId: number, token?: string): Promise<ReadwiseTokenValidationResult> {
    const effective = token?.trim() || (await this.getToken(userId));
    if (!effective) return { valid: false };
    return { valid: await this.client.validateToken(userId, effective) };
  }

  private shouldSeedWatermark(
    existing: ReadwiseUserSetting | undefined,
    rawToken: string | undefined,
    payload: UpsertReadwiseSettingsPayload,
  ): boolean {
    const nextTokenConfigured = Boolean(rawToken || existing?.apiToken || existing?.apiTokenEncrypted);
    const nextEnabled = payload.enabled ?? existing?.enabled ?? true;
    if (!nextTokenConfigured || !nextEnabled) return false;
    if (!existing) return true;
    if (!existing.apiToken && !existing.apiTokenEncrypted) return true;
    if (!existing.enabled && payload.enabled === true && existing.disabledReason !== 'invalid_token') return true;
    return false;
  }

  private resolveDisabledReason(input: { hasPermission: boolean; tokenConfigured: boolean; enabled: boolean }): ReadwiseSyncDisabledReason | null {
    if (!input.hasPermission) return 'permission_denied';
    if (!input.tokenConfigured) return 'missing_token';
    if (!input.enabled) return 'user_disabled';
    return null;
  }
}
