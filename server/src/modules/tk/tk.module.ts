import { Module } from '@nestjs/common';

import { AchievementModule } from '../achievement/achievement.module';
import { TkController } from './tk.controller';
import { TkRepository } from './tk.repository';
import { TK_FETCH } from './tk.tokens';
import { TkAutoSyncSchedulerService } from './tk-auto-sync-scheduler.service';
import { TkEventListener } from './tk-event-listener.service';
import { TkOAuthService } from './tk-oauth.service';
import { TkSettingsService } from './tk-settings.service';
import { TkSyncService } from './tk-sync.service';

@Module({
  imports: [AchievementModule],
  controllers: [TkController],
  providers: [
    TkRepository,
    TkOAuthService,
    TkSettingsService,
    TkSyncService,
    TkAutoSyncSchedulerService,
    TkEventListener,
    { provide: TK_FETCH, useValue: fetch },
  ],
  exports: [TkSettingsService, TkSyncService],
})
export class TkModule {}
