import { Module } from '@nestjs/common';

import { QuickBooksModule } from '../quickbooks/quickbooks.module';
import { SyncController } from './sync.controller';
import { SyncRepository } from './sync.repository';
import { SyncService } from './sync.service';
import { SalesSyncHandler } from './queue/sales-sync.handler';
import { ReturnsSyncHandler } from './queue/returns-sync.handler';
import { ProductsSyncHandler } from './queue/products-sync.handler';
import { SyncQueueService } from './queue/sync-queue.service';
import { SyncWorkerService } from './queue/sync-worker.service';
import { SYNC_JOB_HANDLERS } from './queue/sync-queue.constants';

@Module({
  imports: [QuickBooksModule],
  controllers: [SyncController],
  providers: [
    SyncService,
    SyncRepository,
    SyncQueueService,
    SyncWorkerService,
    SalesSyncHandler,
    ReturnsSyncHandler,
    ProductsSyncHandler,
    // Registry of job-type handlers the worker dispatches to. Add handlers here.
    {
      provide: SYNC_JOB_HANDLERS,
      useFactory: (
        sales: SalesSyncHandler,
        returns: ReturnsSyncHandler,
        products: ProductsSyncHandler,
      ) => [sales, returns, products],
      inject: [SalesSyncHandler, ReturnsSyncHandler, ProductsSyncHandler],
    },
  ],
  exports: [SyncService, SyncQueueService],
})
export class SyncModule {}
