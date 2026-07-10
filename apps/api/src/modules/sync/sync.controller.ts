import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { SyncLog } from '@hardware-pos/database';
import type { Paginated } from '@hardware-pos/shared';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { Permission } from '../auth/permissions';
import { QuerySyncLogsDto } from './dto/query-sync-logs.dto';
import { RefreshResult, RetryResult } from './sync.interfaces';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('logs')
  @RequirePermissions(Permission.SYNC_READ)
  listLogs(
    @TenantId() tenantId: string,
    @Query() query: QuerySyncLogsDto,
  ): Promise<Paginated<SyncLog>> {
    return this.syncService.listLogs(tenantId, query);
  }

  @Post('sales/:id/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(Permission.SYNC_READ)
  retrySale(@TenantId() tenantId: string, @Param('id') id: string): Promise<RetryResult> {
    return this.syncService.retrySale(tenantId, id);
  }

  @Post('products/refresh')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(Permission.SYNC_READ)
  refreshProducts(@TenantId() tenantId: string): Promise<RefreshResult> {
    return this.syncService.refreshProducts(tenantId);
  }
}
