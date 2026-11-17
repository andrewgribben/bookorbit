import { Permission } from '@bookorbit/types';
import { Body, Controller, Get, Patch, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { TkConnectFinishDto, TkConnectStartDto, UpsertTkSettingsDto } from './dto';
import { TkAutoSyncSchedulerService } from './tk-auto-sync-scheduler.service';
import { TkOAuthService } from './tk-oauth.service';
import { TkSettingsService } from './tk-settings.service';

@Controller('tk')
@RequirePermission(Permission.TkSync)
export class TkController {
  constructor(
    private readonly settingsService: TkSettingsService,
    private readonly oauth: TkOAuthService,
    private readonly scheduler: TkAutoSyncSchedulerService,
  ) {}

  @Get('settings')
  getSettings(@CurrentUser() user: RequestUser) {
    return this.settingsService.getSettings(user.id);
  }

  @Patch('settings')
  upsertSettings(@CurrentUser() user: RequestUser, @Body() dto: UpsertTkSettingsDto) {
    return this.settingsService.upsertSettings(user.id, dto);
  }

  @Post('connect/start')
  connectStart(@CurrentUser() user: RequestUser, @Body() dto: TkConnectStartDto) {
    return this.oauth.start(user.id, dto.clientName);
  }

  @Post('connect/finish')
  async connectFinish(@CurrentUser() user: RequestUser, @Body() dto: TkConnectFinishDto) {
    await this.oauth.finish(user.id, dto.callbackUrl);
    return this.settingsService.getSettings(user.id);
  }

  @Post('disconnect')
  async disconnect(@CurrentUser() user: RequestUser) {
    await this.oauth.disconnect(user.id);
    return this.settingsService.getSettings(user.id);
  }

  @Post('sync')
  sync(@CurrentUser() user: RequestUser) {
    this.scheduler.requestSync(user.id);
    return { requested: true };
  }
}
