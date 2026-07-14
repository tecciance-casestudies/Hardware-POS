import { Controller, Get } from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { Permission } from '../auth/permissions';
import { DashboardService } from './dashboard.service';
import { DashboardStats } from './dashboard.types';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @RequirePermissions(Permission.SALE_READ)
  stats(@TenantId() tenantId: string): Promise<DashboardStats> {
    return this.dashboardService.getStats(tenantId);
  }
}
