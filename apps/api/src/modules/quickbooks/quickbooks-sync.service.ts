import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { QuickBooksConfig } from './quickbooks.config';
import { QuickBooksRepository } from './quickbooks.repository';
import { QuickBooksService } from './quickbooks.service';
import { queryItems, type QboItem } from './quickbooks.api';

export interface SyncProductsSummary {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  total: number;
}

/** QuickBooks item types we import into the local product cache. */
const IMPORTABLE_TYPES = new Set(['Inventory', 'NonInventory']);

@Injectable()
export class QuickBooksSyncService {
  private readonly logger = new Logger(QuickBooksSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: QuickBooksService,
    private readonly connections: QuickBooksRepository,
    private readonly config: QuickBooksConfig,
  ) {}

  /**
   * Pull inventory + non-inventory items from QuickBooks and upsert them into the
   * local Product cache. Uses the stored token (refreshing if expired), records a
   * sync log, and returns per-item counts.
   */
  async syncProducts(tenantId: string): Promise<SyncProductsSummary> {
    const connection = await this.connections.find(tenantId);
    if (!connection || !connection.isActive) {
      throw new NotFoundException('QuickBooks is not connected');
    }

    const accessToken = await this.oauth.getValidAccessToken(tenantId); // refreshes if expired
    const { apiBase } = this.config.resolve();

    const items = await queryItems({ apiBase, realmId: connection.realmId, accessToken });

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of items) {
      if (!item.Type || !IMPORTABLE_TYPES.has(item.Type)) {
        skipped++;
        continue;
      }
      try {
        const outcome = await this.upsertItem(tenantId, item);
        if (outcome === 'created') created++;
        else updated++;
      } catch (err) {
        failed++;
        this.logger.warn(`Failed to sync item ${item.Id}: ${(err as Error).message}`);
      }
    }

    const summary: SyncProductsSummary = { created, updated, skipped, failed, total: items.length };

    await this.prisma.syncLog.create({
      data: {
        tenantId,
        entityType: 'PRODUCT',
        entityId: null,
        direction: 'INBOUND',
        status: failed > 0 ? 'FAILED' : 'SYNCED',
        message: `QuickBooks product sync: ${created} created, ${updated} updated, ${skipped} skipped, ${failed} failed`,
      },
    });

    this.logger.log(`QuickBooks product sync for ${tenantId}: ${JSON.stringify(summary)}`);
    return summary;
  }

  private async upsertItem(tenantId: string, item: QboItem): Promise<'created' | 'updated'> {
    const quickbooksItemId = String(item.Id);
    const existing = await this.prisma.product.findUnique({
      where: { tenantId_quickbooksItemId: { tenantId, quickbooksItemId } },
    });

    const data = {
      name: item.Name,
      sku: item.Sku ?? null,
      description: item.Description ?? null,
      unitPrice: item.UnitPrice ?? 0,
      quantityOnHand: item.QtyOnHand ?? 0,
      type: item.Type ?? null,
      isActive: item.Active ?? true,
      syncStatus: 'SYNCED' as const,
      lastSyncedAt: new Date(),
    };

    await this.prisma.product.upsert({
      where: { tenantId_quickbooksItemId: { tenantId, quickbooksItemId } },
      update: data,
      create: { tenantId, quickbooksItemId, ...data },
    });

    return existing ? 'updated' : 'created';
  }
}
