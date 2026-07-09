import { Module } from '@nestjs/common';

import { DiscountsModule } from '../discounts/discounts.module';
import { SettingsModule } from '../settings/settings.module';
import { SyncModule } from '../sync/sync.module';
import { SalesController } from './sales.controller';
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';

@Module({
  imports: [SettingsModule, DiscountsModule, SyncModule],
  controllers: [SalesController],
  providers: [SalesService, SalesRepository],
  exports: [SalesService],
})
export class SalesModule {}
