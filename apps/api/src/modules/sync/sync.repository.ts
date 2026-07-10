import { Injectable } from '@nestjs/common';
import { Prisma, SyncLog, SyncStatus } from '@hardware-pos/database';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SyncRepository {
  constructor(private readonly prisma: PrismaService) {}

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
