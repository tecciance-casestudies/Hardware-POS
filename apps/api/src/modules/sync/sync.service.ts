import { Injectable, NotImplementedException } from '@nestjs/common';
import { SyncLog } from '@hardware-pos/database';
import type { Paginated } from '@hardware-pos/shared';

import { paginate } from '../../common/pagination';
import { QuerySyncLogsDto } from './dto/query-sync-logs.dto';
import { RefreshResult, RetryResult } from './sync.interfaces';
import { SyncRepository } from './sync.repository';
import { SyncQueueService } from './queue/sync-queue.service';

@Injectable()
export class SyncService {
  constructor(
    private readonly syncRepository: SyncRepository,
    private readonly syncQueue: SyncQueueService,
  ) {}

  /** Queue health summary for the header sync pill. */
  status(tenantId: string) {
    return this.syncRepository.statusSummary(tenantId);
  }

  async listLogs(tenantId: string, query: QuerySyncLogsDto): Promise<Paginated<SyncLog>> {
    const [items, total] = await this.syncRepository.findLogs(
      tenantId,
      { entityType: query.entityType, status: query.status },
      query.skip,
      query.take,
    );
    return paginate(items, total, query.page, query.pageSize);
  }

  /**
   * Manual "Retry Sync": re-queue a sale's failed sync job so the worker retries
   * it on the next poll (with a fresh attempt budget).
   */
  retrySale(tenantId: string, saleId: string): Promise<RetryResult> {
    return this.syncQueue.requeueSale(tenantId, saleId);
  }

  /** TODO: enqueue an inbound catalog pull from QuickBooks. */
  refreshProducts(_tenantId: string): Promise<RefreshResult> {
    throw new NotImplementedException('Product refresh is not implemented yet');
  }
}
