import { Injectable } from '@nestjs/common';

import type { TkSettings, TkSyncDisabledReason, UpsertTkSettingsPayload } from '@bookorbit/types';

import { TkAutoSyncSchedulerService } from './tk-auto-sync-scheduler.service';
import { TkRepository } from './tk.repository';

@Injectable()
export class TkSettingsService {
  constructor(
    private readonly repo: TkRepository,
    private readonly scheduler: TkAutoSyncSchedulerService,
  ) {}

  async getSettings(userId: number): Promise<TkSettings> {
    const [row, hasPermission] = await Promise.all([this.repo.findSettings(userId), this.repo.userHasTkSyncPermission(userId)]);
    const connected = Boolean(row?.accessTokenEnc && row?.refreshTokenEnc);
    const enabled = row?.enabled ?? false;

    return {
      connected,
      enabled,
      effectiveEnabled: hasPermission && connected && enabled,
      disabledReason:
        (row?.disabledReason as TkSyncDisabledReason | null | undefined) ?? this.resolveDisabledReason({ hasPermission, connected, enabled }),
      lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
      connectedAt: row?.connectedAt?.toISOString() ?? null,
      backfillRequestedAt: row?.backfillRequestedAt?.toISOString() ?? null,
    };
  }

  async upsertSettings(userId: number, payload: UpsertTkSettingsPayload): Promise<TkSettings> {
    if (payload.enabled !== undefined) {
      await this.repo.upsertSettings(userId, { enabled: payload.enabled, ...(payload.enabled ? { disabledReason: null } : {}) });
    }
    const settings = await this.getSettings(userId);
    if (settings.effectiveEnabled) this.scheduler.requestSync(userId);
    return settings;
  }

  private resolveDisabledReason(input: { hasPermission: boolean; connected: boolean; enabled: boolean }): TkSyncDisabledReason | null {
    if (!input.hasPermission) return 'permission_denied';
    if (!input.connected) return 'missing_token';
    if (!input.enabled) return null;
    return null;
  }
}
