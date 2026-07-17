import { Injectable } from '@nestjs/common';

import { QuickBooksProductSyncService } from '../../quickbooks/quickbooks-product-sync.service';
import { SyncJobContext, SyncJobHandler, SyncJobOutcome } from './sync-job-handler';
import { SyncJobType } from './sync-queue.constants';

/**
 * Handles PRODUCT_SYNC jobs by pushing the product to QuickBooks (create the
 * Item on first push, sparse-update it afterwards). Same contract as the sales
 * handler: report the outcome, let the queue own the job lifecycle.
 */
@Injectable()
export class ProductsSyncHandler implements SyncJobHandler {
  readonly type = SyncJobType.PRODUCT_SYNC;

  constructor(private readonly productSync: QuickBooksProductSyncService) {}

  async handle(job: SyncJobContext): Promise<SyncJobOutcome> {
    if (!job.entityId) {
      return { success: false, message: 'Sync job has no product id' };
    }
    const result = await this.productSync.syncProduct(job.tenantId, job.entityId);
    // SKIPPED (e.g. a draft) is a terminal non-error: retrying would not help.
    return { success: result.status !== 'FAILED', message: result.message };
  }
}
