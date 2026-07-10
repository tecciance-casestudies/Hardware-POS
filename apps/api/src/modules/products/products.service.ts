import { Injectable, NotFoundException } from '@nestjs/common';
import { Product } from '@hardware-pos/database';
import type { Paginated } from '@hardware-pos/shared';

import { paginate } from '../../common/pagination';
import { MockSyncSummary, ProductsRepository } from './products.repository';
import { QueryProductsDto } from './dto/query-products.dto';
import { SearchProductsDto } from './dto/search-products.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async list(tenantId: string, query: QueryProductsDto): Promise<Paginated<Product>> {
    const [items, total] = await this.productsRepository.search(
      tenantId,
      query.search,
      query.skip,
      query.take,
    );
    return paginate(items, total, query.page, query.pageSize);
  }

  async search(tenantId: string, query: SearchProductsDto): Promise<Paginated<Product>> {
    const [items, total] = await this.productsRepository.advancedSearch(
      tenantId,
      {
        name: query.name,
        sku: query.sku,
        barcode: query.barcode,
        categoryId: query.categoryId,
        isActive: query.isActive,
      },
      query.skip,
      query.take,
    );
    return paginate(items, total, query.page, query.pageSize);
  }

  async getById(tenantId: string, id: string): Promise<Product> {
    const product = await this.productsRepository.findByIdForTenant(tenantId, id);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async getByBarcode(tenantId: string, barcode: string): Promise<Product> {
    const product = await this.productsRepository.findByBarcode(tenantId, barcode);
    if (!product) {
      throw new NotFoundException(`No product with barcode ${barcode}`);
    }
    return product;
  }

  /**
   * Mock QuickBooks sync — refreshes the local product cache from the mock
   * catalog. Stock/prices are only ever updated via sync, never edited in the POS.
   */
  mockSync(tenantId: string): Promise<MockSyncSummary> {
    return this.productsRepository.mockSync(tenantId);
  }
}
