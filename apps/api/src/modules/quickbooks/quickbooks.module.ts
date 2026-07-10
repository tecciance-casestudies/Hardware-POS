import { Module } from '@nestjs/common';

import { QuickBooksConfig } from './quickbooks.config';
import { QuickBooksController } from './quickbooks.controller';
import { QuickBooksRepository } from './quickbooks.repository';
import { QuickBooksService } from './quickbooks.service';
import { QuickBooksSyncService } from './quickbooks-sync.service';
import { QuickBooksSalesSyncService } from './quickbooks-sales-sync.service';

@Module({
  controllers: [QuickBooksController],
  providers: [
    QuickBooksService,
    QuickBooksSyncService,
    QuickBooksSalesSyncService,
    QuickBooksRepository,
    QuickBooksConfig,
  ],
  exports: [QuickBooksService, QuickBooksSyncService, QuickBooksSalesSyncService],
})
export class QuickBooksModule {}
