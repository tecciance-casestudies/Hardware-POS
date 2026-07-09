import { Module } from '@nestjs/common';

import { SettingsModule } from '../settings/settings.module';
import { SalesController } from './sales.controller';
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';

@Module({
  imports: [SettingsModule],
  controllers: [SalesController],
  providers: [SalesService, SalesRepository],
  exports: [SalesService],
})
export class SalesModule {}
