import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import { QuickBooksConfig } from './quickbooks.config';
import { QuickBooksSyncService } from './quickbooks-sync.service';

/**
 * Scheduled product pull: on an interval, refresh the local product cache from
 * QuickBooks for every connected tenant, so prices and stock stay current
 * without anyone pressing "Sync Products".
 *
 * Disable via `QUICKBOOKS_AUTO_PULL_ENABLED=false`; tune the cadence with
 * `QUICKBOOKS_AUTO_PULL_INTERVAL_MS` (default 15 minutes).
 */
@Injectable()
export class QuickBooksAutoPullService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(QuickBooksAutoPullService.name);
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: QuickBooksSyncService,
    private readonly qbConfig: QuickBooksConfig,
    configService: ConfigService,
  ) {
    this.enabled = configService.get<string>('QUICKBOOKS_AUTO_PULL_ENABLED', 'true') !== 'false';
    this.intervalMs = configService.get<number>('QUICKBOOKS_AUTO_PULL_INTERVAL_MS', 15 * 60_000);
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) {
      this.logger.log('QuickBooks auto-pull disabled (QUICKBOOKS_AUTO_PULL_ENABLED=false)');
      return;
    }
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.logger.log(`QuickBooks auto-pull every ${Math.round(this.intervalMs / 1000)}s`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.ticking) return; // skip overlapping runs (a pull can outlast the interval)
    if (!this.qbConfig.isConfigured()) return;
    this.ticking = true;
    try {
      const connections = await this.prisma.quickBooksConnection.findMany({
        where: { isActive: true },
        select: { tenantId: true },
      });
      for (const { tenantId } of connections) {
        try {
          const summary = await this.syncService.syncProducts(tenantId);
          this.logger.log(
            `Auto-pull for ${tenantId}: ${summary.created} created, ${summary.updated} updated, ${summary.failed} failed`,
          );
        } catch (err) {
          // One tenant's failure (expired tokens, QBO outage) must not stop the rest.
          this.logger.warn(`Auto-pull failed for ${tenantId}: ${(err as Error).message}`);
        }
      }
    } finally {
      this.ticking = false;
    }
  }
}
