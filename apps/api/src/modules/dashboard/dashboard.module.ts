import { Module } from '@nestjs/common';

import { SettingsModule } from '../settings/settings.module';
import { DashboardController } from './dashboard.controller';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [SettingsModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository],
})
export class DashboardModule {}
