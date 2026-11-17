import { BadRequestException, Injectable } from '@nestjs/common';

import type { TkBackfillPreview } from '@bookorbit/types';

import { TkAutoSyncSchedulerService } from './tk-auto-sync-scheduler.service';
import { TkRepository } from './tk.repository';
import { TkSyncService } from './tk-sync.service';

@Injectable()
export class TkBackfillService {
  constructor(
    private readonly repo: TkRepository,
    private readonly syncService: TkSyncService,
    private readonly scheduler: TkAutoSyncSchedulerService,
  ) {}

  preview(userId: number): Promise<TkBackfillPreview> {
    return this.syncService.previewBackfill(userId);
  }

  /**
   * Flips on `backfillRequestedAt` (idempotent) and wakes the scheduler. The flush path then
   * sends every pending item regardless of `connectedAt`, oldest day first; the ledger and
   * link-in-note check make stopping and resuming safe, so this never needs to track progress
   * itself.
   */
  async requestBackfill(userId: number): Promise<void> {
    const settings = await this.repo.findSettings(userId);
    if (!settings?.connectedAt) throw new BadRequestException('Connect TK before requesting a backfill');
    if (!settings.backfillRequestedAt) await this.repo.upsertSettings(userId, { backfillRequestedAt: new Date() });
    this.scheduler.requestSync(userId);
  }
}
