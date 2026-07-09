import { Module } from '@nestjs/common';

import { QuickBooksModule } from '../quickbooks/quickbooks.module';
import { SyncController } from './sync.controller';
import { SyncRepository } from './sync.repository';
import { SyncService } from './sync.service';
import { SalesSyncHandler } from './queue/sales-sync.handler';
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
    // Registry of job-type handlers the worker dispatches to. Add handlers here.
    {
      provide: SYNC_JOB_HANDLERS,
      useFactory: (sales: SalesSyncHandler) => [sales],
      inject: [SalesSyncHandler],
    },
  ],
  exports: [SyncService, SyncQueueService],
})
export class SyncModule {}
