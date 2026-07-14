import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { DashboardStats } from './dashboard.types';

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(tenantId: string): Promise<DashboardStats> {
    // "Today" is the API server's local midnight.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [todayAgg, productsCached, pendingSyncs] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { tenantId, status: 'COMPLETED', completedAt: { gte: startOfToday } },
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.product.count({ where: { tenantId, isActive: true } }),
      this.prisma.sale.count({
        where: { tenantId, status: 'COMPLETED', syncStatus: { not: 'SYNCED' } },
      }),
    ]);

    return {
      todaySalesTotal: Number(todayAgg._sum.total ?? 0),
      todayTransactions: todayAgg._count._all,
      productsCached,
      pendingSyncs,
    };
  }
}
