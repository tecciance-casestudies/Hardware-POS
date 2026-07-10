import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { PrintJob, Receipt } from '@hardware-pos/database';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { Permission } from '../auth/permissions';
import { CustomerReceiptResult, ReceiptsService } from './receipts.service';

@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  /** Generate the customer receipt (+ warehouse copy if any item needs pickup). */
  @Post(':saleId/customer')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.SALE_CREATE)
  customer(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('saleId') saleId: string,
  ): Promise<CustomerReceiptResult> {
    return this.receiptsService.generateCustomer(tenantId, saleId, user.id);
  }

  /** Generate (or reprint) the warehouse picking copy. */
  @Post(':saleId/warehouse')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.SALE_CREATE)
  warehouse(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('saleId') saleId: string,
  ): Promise<PrintJob> {
    return this.receiptsService.generateWarehouse(tenantId, saleId, user.id);
  }

  @Get('sale/:saleId')
  @RequirePermissions(Permission.SALE_READ)
  bySale(@TenantId() tenantId: string, @Param('saleId') saleId: string): Promise<Receipt> {
    return this.receiptsService.getReceiptBySale(tenantId, saleId);
  }

  @Get(':id')
  @RequirePermissions(Permission.SALE_READ)
  byId(@TenantId() tenantId: string, @Param('id') id: string): Promise<Receipt> {
    return this.receiptsService.getReceiptById(tenantId, id);
  }
}
