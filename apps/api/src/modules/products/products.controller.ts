import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Product } from '@hardware-pos/database';
import type { Paginated } from '@hardware-pos/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { Permission } from '../auth/permissions';
import { MockSyncSummary } from './products.repository';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { SaveVariationConfigDto } from './dto/save-variation-config.dto';
import { SearchProductsDto } from './dto/search-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

/** Uploaded file shape from multer (memory storage). */
interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
}

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions(Permission.PRODUCT_READ)
  list(@TenantId() tenantId: string, @Query() query: QueryProductsDto): Promise<Paginated<Product>> {
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
  getByBarcode(@TenantId() tenantId: string, @Param('barcode') barcode: string): Promise<Product> {
    return this.productsService.getByBarcode(tenantId, barcode);
  }

  @Post()
  @RequirePermissions(Permission.PRODUCT_MANAGE)
  create(@TenantId() tenantId: string, @Body() dto: CreateProductDto): Promise<Product> {
    return this.productsService.create(tenantId, dto);
  }

  /** Refresh the product cache from a mock QuickBooks pull. Owner/admin only. */
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

  /** The product-variation wizard state (attributes, price mode, variants). */
  @Get(':id/variation-config')
  @RequirePermissions(Permission.PRODUCT_READ)
  getVariationConfig(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ): Promise<{ config: unknown | null }> {
    return this.productsService.getVariationConfig(tenantId, id);
  }

  @Put(':id/variation-config')
  @RequirePermissions(Permission.PRODUCT_MANAGE)
  saveVariationConfig(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: SaveVariationConfigDto,
  ): Promise<{ config: unknown | null }> {
    return this.productsService.saveVariationConfig(tenantId, id, dto.config);
  }

  @Patch(':id')
  @RequirePermissions(Permission.PRODUCT_MANAGE)
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<Product> {
    return this.productsService.update(tenantId, id, dto, user.role);
  }

  /** Soft-delete (deactivate). Sale history keeps referencing the product. */
  @Delete(':id')
  @RequirePermissions(Permission.PRODUCT_MANAGE)
  deactivate(@TenantId() tenantId: string, @Param('id') id: string): Promise<Product> {
    return this.productsService.deactivate(tenantId, id);
  }

  @Post(':id/image')
  @RequirePermissions(Permission.PRODUCT_MANAGE)
  // Nest's FileInterceptor defaults to multer memory storage, so the file has `.buffer`.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadImage(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @UploadedFile() file: UploadedImage | undefined,
  ): Promise<Product> {
    return this.productsService.setImage(tenantId, id, file);
  }

  @Delete(':id/image')
  @RequirePermissions(Permission.PRODUCT_MANAGE)
  removeImage(@TenantId() tenantId: string, @Param('id') id: string): Promise<Product> {
    return this.productsService.removeImage(tenantId, id);
  }

  @Post(':id/sync-to-quickbooks')
  @RequirePermissions(Permission.QUICKBOOKS_MANAGE)
  syncToQuickBooks(@TenantId() tenantId: string, @Param('id') id: string): Promise<Product> {
    return this.productsService.syncToQuickBooks(tenantId, id);
  }
}
