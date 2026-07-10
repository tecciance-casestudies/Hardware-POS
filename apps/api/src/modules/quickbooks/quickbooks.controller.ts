import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Res } from '@nestjs/common';
import { UserRole } from '@hardware-pos/database';
import type { Response } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { Permission } from '../auth/permissions';
import { QuickBooksCallbackQuery, QuickBooksConnectionStatus } from './quickbooks.interfaces';
import { QuickBooksService } from './quickbooks.service';
import { QuickBooksSyncService, type SyncProductsSummary } from './quickbooks-sync.service';
import {
  QuickBooksSalesSyncService,
  type SaleSyncResult,
} from './quickbooks-sales-sync.service';

@Controller('quickbooks')
export class QuickBooksController {
  constructor(
    private readonly quickBooksService: QuickBooksService,
    private readonly quickBooksSyncService: QuickBooksSyncService,
    private readonly quickBooksSalesSyncService: QuickBooksSalesSyncService,
  ) {}

  /** Redirect the admin to the QuickBooks authorization screen. Owner/admin only. */
  @Get('connect')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async connect(@TenantId() tenantId: string, @Res() res: Response): Promise<void> {
    const url = await this.quickBooksService.getAuthorizationUrl(tenantId);
    res.redirect(url);
  }

  /** OAuth redirect target from QuickBooks — public (no session on the redirect). */
  @Public()
  @Get('callback')
  async callback(
    @Query() query: QuickBooksCallbackQuery,
    @Res() res: Response,
  ): Promise<void> {
    const redirectTo = await this.quickBooksService.handleCallback(query);
    res.redirect(redirectTo);
  }

  /** Disconnect the company: revoke the token and remove the stored connection. */
  @Post('disconnect')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  disconnect(@TenantId() tenantId: string): Promise<{ disconnected: boolean }> {
    return this.quickBooksService.disconnect(tenantId);
  }

  /** Connection status — never exposes tokens. */
  @Get('status')
  @RequirePermissions(Permission.QUICKBOOKS_READ)
  status(@TenantId() tenantId: string): Promise<QuickBooksConnectionStatus> {
    return this.quickBooksService.getConnectionStatus(tenantId);
  }

  /** Pull inventory + non-inventory items from QuickBooks into the local cache. */
  @Post('sync-products')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.QUICKBOOKS_MANAGE)
  syncProducts(@TenantId() tenantId: string): Promise<SyncProductsSummary> {
    return this.quickBooksSyncService.syncProducts(tenantId);
  }

  /**
   * Push a completed sale to QuickBooks (Sales Receipt when fully paid, Invoice +
   * linked Payment otherwise). A failed push keeps the sale and marks it FAILED.
   */
  @Post('sync-sale/:saleId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.QUICKBOOKS_MANAGE)
  syncSale(
    @TenantId() tenantId: string,
    @Param('saleId') saleId: string,
  ): Promise<SaleSyncResult> {
    return this.quickBooksSalesSyncService.syncSale(tenantId, saleId);
  }

  /** Retry a failed sale sync identified by its sync-log id. */
  @Post('retry/:syncLogId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.QUICKBOOKS_MANAGE)
  retry(
    @TenantId() tenantId: string,
    @Param('syncLogId') syncLogId: string,
  ): Promise<SaleSyncResult> {
    return this.quickBooksSalesSyncService.retry(tenantId, syncLogId);
  }
}
