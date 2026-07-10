import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { Product } from '@hardware-pos/database';
import type { Paginated } from '@hardware-pos/shared';

import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { Permission } from '../auth/permissions';
import { MockSyncSummary } from './products.repository';
import { ProductsService } from './products.service';
import { QueryProductsDto } from './dto/query-products.dto';
import { SearchProductsDto } from './dto/search-products.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions(Permission.PRODUCT_READ)
  list(
    @TenantId() tenantId: string,
    @Query() query: QueryProductsDto,
  ): Promise<Paginated<Product>> {
    return this.productsService.list(tenantId, query);
  }

  // Static routes must precede the ':id' param route so they are not shadowed.
  @Get('search')
  @RequirePermissions(Permission.PRODUCT_READ)
  search(
    @TenantId() tenantId: string,
    @Query() query: SearchProductsDto,
  ): Promise<Paginated<Product>> {
    return this.productsService.search(tenantId, query);
  }

  @Get('barcode/:barcode')
  @RequirePermissions(Permission.PRODUCT_READ)
  getByBarcode(
    @TenantId() tenantId: string,
    @Param('barcode') barcode: string,
  ): Promise<Product> {
    return this.productsService.getByBarcode(tenantId, barcode);
  }

  /**
   * Refresh the product cache from a mock QuickBooks pull. Owner/admin only.
   * This is the sole way to create/update products — the POS never edits stock.
   */
  @Post('sync/mock')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.QUICKBOOKS_MANAGE)
  mockSync(@TenantId() tenantId: string): Promise<MockSyncSummary> {
    return this.productsService.mockSync(tenantId);
  }

  @Get(':id')
  @RequirePermissions(Permission.PRODUCT_READ)
  getById(@TenantId() tenantId: string, @Param('id') id: string): Promise<Product> {
    return this.productsService.getById(tenantId, id);
  }
}
