import { Body, Controller, Get, Put } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { Permission } from '../auth/permissions';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { AppSettings } from './settings.interfaces';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings(@TenantId() tenantId: string): AppSettings {
    return this.settingsService.getSettings(tenantId);
  }

  @Put()
  @RequirePermissions(Permission.SETTINGS_MANAGE)
  updateSettings(
    @TenantId() tenantId: string,
    @Body() dto: UpdateSettingsDto,
  ): Promise<AppSettings> {
    return this.settingsService.updateSettings(tenantId, dto);
  }
}
