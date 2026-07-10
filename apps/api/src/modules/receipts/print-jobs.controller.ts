import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PrintJob } from '@hardware-pos/database';
import type { Paginated } from '@hardware-pos/shared';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { Permission } from '../auth/permissions';
import { QueryPrintJobsDto } from './dto/query-print-jobs.dto';
import { ReceiptsService } from './receipts.service';

@Controller('print-jobs')
export class PrintJobsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get()
  @RequirePermissions(Permission.SALE_READ)
  list(
    @TenantId() tenantId: string,
    @Query() query: QueryPrintJobsDto,
  ): Promise<Paginated<PrintJob>> {
    return this.receiptsService.listPrintJobs(tenantId, query);
  }

  @Post(':id/mark-printed')
  @RequirePermissions(Permission.SALE_CREATE)
  markPrinted(@TenantId() tenantId: string, @Param('id') id: string): Promise<PrintJob> {
    return this.receiptsService.markPrinted(tenantId, id);
  }
}
