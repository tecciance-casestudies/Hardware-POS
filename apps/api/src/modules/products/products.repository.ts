import { Injectable } from '@nestjs/common';
import {
  MOCK_HARDWARE_PRODUCTS,
  mockCategoryId,
  mockCategoryNames,
  Prisma,
  Product,
} from '@hardware-pos/database';

import { PrismaService } from '../../prisma/prisma.service';

export interface ProductSearchFilters {
  name?: string;
  sku?: string;
  barcode?: string;
  categoryId?: string;
  isActive?: boolean;
}

export interface MockSyncSummary {
  created: number;
  updated: number;
  total: number;
  categories: number;
}

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Free-text search across name / sku / barcode (used by GET /products). */
  async search(
    tenantId: string,
    search: string | undefined,
    skip: number,
    take: number,
  ): Promise<[Product[], number]> {
    const where: Prisma.ProductWhereInput = {
      tenantId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { barcode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.$transaction([
      this.prisma.product.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
      this.prisma.product.count({ where }),
    ]);
  }

  /** Structured search combining name / sku / barcode / category / active status. */
  async advancedSearch(
    tenantId: string,
    filters: ProductSearchFilters,
    skip: number,
    take: number,
  ): Promise<[Product[], number]> {
    const where: Prisma.ProductWhereInput = {
      tenantId,
      ...(filters.name ? { name: { contains: filters.name, mode: 'insensitive' } } : {}),
      ...(filters.sku ? { sku: { contains: filters.sku, mode: 'insensitive' } } : {}),
      ...(filters.barcode ? { barcode: { contains: filters.barcode, mode: 'insensitive' } } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    };

    return this.prisma.$transaction([
      this.prisma.product.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
      this.prisma.product.count({ where }),
    ]);
  }

  findByIdForTenant(tenantId: string, id: string): Promise<Product | null> {
    return this.prisma.product.findFirst({ where: { id, tenantId } });
  }

  findByBarcode(tenantId: string, barcode: string): Promise<Product | null> {
    return this.prisma.product.findFirst({ where: { tenantId, barcode } });
  }

  /**
   * Simulate a QuickBooks catalog pull: upsert the mock hardware products and
   * their categories, marking each SYNCED. This is the ONLY write path for the
   * product cache — the POS never edits stock directly. Runs in a transaction
   * and records a single inbound SyncLog entry.
   */
  async mockSync(tenantId: string): Promise<MockSyncSummary> {
    return this.prisma.$transaction(async (tx) => {
      // Ensure categories (deterministic ids keep repeated syncs idempotent).
      for (const name of mockCategoryNames()) {
        const id = mockCategoryId(tenantId, name);
        await tx.productCategory.upsert({
          where: { id },
          update: { name, isActive: true },
          create: { id, tenantId, name },
        });
      }

      let created = 0;
      let updated = 0;
      const now = new Date();

      for (const p of MOCK_HARDWARE_PRODUCTS) {
        const existing = await tx.product.findUnique({
          where: { tenantId_quickbooksItemId: { tenantId, quickbooksItemId: p.quickbooksItemId } },
        });

        const data = {
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          description: p.description ?? null,
          categoryId: mockCategoryId(tenantId, p.category),
          unitType: p.unitType,
          unitPrice: p.unitPrice,
          quantityOnHand: p.quantityOnHand,
          type: p.type,
          requiresWarehousePickup: p.requiresWarehousePickup ?? false,
          isActive: true,
          syncStatus: 'SYNCED' as const,
          lastSyncedAt: now,
        };

        await tx.product.upsert({
          where: { tenantId_quickbooksItemId: { tenantId, quickbooksItemId: p.quickbooksItemId } },
          update: data,
          create: { tenantId, quickbooksItemId: p.quickbooksItemId, ...data },
        });

        existing ? updated++ : created++;
      }

      await tx.syncLog.create({
        data: {
          tenantId,
          entityType: 'PRODUCT',
          direction: 'INBOUND',
          status: 'SYNCED',
          message: `Mock QuickBooks product sync: ${created} created, ${updated} updated`,
        },
      });

      return { created, updated, total: MOCK_HARDWARE_PRODUCTS.length, categories: mockCategoryNames().length };
    });
  }
}
