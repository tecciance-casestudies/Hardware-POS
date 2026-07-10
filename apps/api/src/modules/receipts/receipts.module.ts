import { Module } from '@nestjs/common';

import { SettingsModule } from '../settings/settings.module';
import { PrintJobsController } from './print-jobs.controller';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsRepository } from './receipts.repository';
import { ReceiptsService } from './receipts.service';

@Module({
  imports: [SettingsModule],
  controllers: [ReceiptsController, PrintJobsController],
  providers: [ReceiptsService, ReceiptsRepository],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
