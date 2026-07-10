import { Controller, Get, Query } from '@nestjs/common';
import { AuditLog } from '@hardware-pos/database';
import type { Paginated } from '@hardware-pos/shared';

import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuditLogService } from './audit-log.service';

@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  list(
    @TenantId() tenantId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<AuditLog>> {
    return this.auditLogService.list(tenantId, query);
  }
}
