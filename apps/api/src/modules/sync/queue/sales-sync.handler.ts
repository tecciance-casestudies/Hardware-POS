import { Injectable } from '@nestjs/common';

import { QuickBooksSalesSyncService } from '../../quickbooks/quickbooks-sales-sync.service';
import { SyncJobContext, SyncJobHandler, SyncJobOutcome } from './sync-job-handler';
import { SyncJobType } from './sync-queue.constants';

/**
 * Handles SALES_SYNC jobs by pushing the sale to QuickBooks. Pure domain work:
 * it reports success/failure and lets the queue own the job lifecycle, so the
 * same handler works unchanged behind a BullMQ worker.
 */
@Injectable()
export class SalesSyncHandler implements SyncJobHandler {
  readonly type = SyncJobType.SALES_SYNC;

  constructor(private readonly salesSync: QuickBooksSalesSyncService) {}

  async handle(job: SyncJobContext): Promise<SyncJobOutcome> {
    if (!job.entityId) {
      return { success: false, message: 'Sync job has no sale id' };
    }
    const result = await this.salesSync.syncSale(job.tenantId, job.entityId);
    return { success: result.status === 'SYNCED', message: result.message };
  }
}
