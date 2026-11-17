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
      syncAnnotations: row?.syncAnnotations ?? true,
      syncJournal: row?.syncJournal ?? true,
      syncFinished: row?.syncFinished ?? true,
    };
  }

  async upsertSettings(userId: number, payload: UpsertTkSettingsPayload): Promise<TkSettings> {
    const update: Partial<{ enabled: boolean; disabledReason: null; syncAnnotations: boolean; syncJournal: boolean; syncFinished: boolean }> = {};
    if (payload.enabled !== undefined) {
      update.enabled = payload.enabled;
      if (payload.enabled) update.disabledReason = null;
    }
    if (payload.syncAnnotations !== undefined) update.syncAnnotations = payload.syncAnnotations;
    if (payload.syncJournal !== undefined) update.syncJournal = payload.syncJournal;
    if (payload.syncFinished !== undefined) update.syncFinished = payload.syncFinished;
    if (Object.keys(update).length > 0) await this.repo.upsertSettings(userId, update);

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
