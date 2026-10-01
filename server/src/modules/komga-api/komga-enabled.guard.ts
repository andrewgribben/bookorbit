import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';

import { APP_SETTING_KEYS } from '../../common/constants/app-settings.constants';
import { AppSettingsService } from '../app-settings/app-settings.service';

@Injectable()
export class KomgaEnabledGuard implements CanActivate {
  constructor(private readonly appSettingsService: AppSettingsService) {}

  async canActivate(): Promise<boolean> {
    const settings = await this.appSettingsService.listSettings();
    const komgaRow = settings.find((s) => s.key === APP_SETTING_KEYS.KOMGA_ENABLED);
    if (komgaRow?.value !== 'true') {
      throw new ForbiddenException('Komga API is disabled');
    }
    return true;
  }
}
