import { Injectable } from '@nestjs/common';
import { Prisma, SyncLog, SyncStatus } from '@hardware-pos/database';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SyncRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Live queue health for the header pill: open jobs, failures, last success. */
  async statusSummary(tenantId: string): Promise<{
    pendingCount: number;
    failedCount: number;
    pushedSalesCount: number;
    lastSyncedAt: Date | null;
    quickbooksConnected: boolean;
  }> {
    const [pendingCount, failedCount, pushedSalesCount, lastDone, connection] =
      await this.prisma.$transaction([
        this.prisma.syncJob.count({
          where: { tenantId, status: { in: ['PENDING', 'SYNCING'] } },
        }),
        this.prisma.syncJob.count({ where: { tenantId, status: 'FAILED' } }),
        this.prisma.sale.count({ where: { tenantId, syncStatus: 'SYNCED' } }),
        this.prisma.syncJob.findFirst({
          where: { tenantId, status: 'SYNCED' },
          orderBy: { completedAt: 'desc' },
          select: { completedAt: true },
        }),
        this.prisma.quickBooksConnection.findFirst({
          where: { tenantId },
          select: { id: true },
        }),
      ]);
    return {
      pendingCount,
      failedCount,
      pushedSalesCount,
      lastSyncedAt: lastDone?.completedAt ?? null,
      quickbooksConnected: !!connection,
    };
  }

  async findLogs(
    tenantId: string,
    filters: { entityType?: string; status?: SyncStatus },
    skip: number,
    take: number,
  ): Promise<[SyncLog[], number]> {
    const where: Prisma.SyncLogWhereInput = {
      tenantId,
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };

    return this.prisma.$transaction([
      this.prisma.syncLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.syncLog.count({ where }),
    ]);
  }
}
