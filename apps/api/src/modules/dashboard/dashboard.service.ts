import { Injectable } from '@nestjs/common';

import { DashboardRepository } from './dashboard.repository';
import { DashboardStats } from './dashboard.types';

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  getStats(tenantId: string): Promise<DashboardStats> {
    return this.dashboardRepository.getStats(tenantId);
  }
}
