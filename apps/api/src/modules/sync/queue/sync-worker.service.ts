import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncJob } from '@hardware-pos/database';

import { SyncJobHandler } from './sync-job-handler';
import { SYNC_JOB_HANDLERS } from './sync-queue.constants';
import { SyncQueueService } from './sync-queue.service';

/**
 * Polling worker that drains the sync queue. On an interval it recovers stale
 * jobs, claims a batch of due jobs, and dispatches each to its registered handler,
 * marking the outcome. This is the piece a BullMQ `Worker` replaces later — the
 * queue service, handlers, and producers stay as-is.
 *
 * Disable via `SYNC_WORKER_ENABLED=false` (e.g. in tests, or when a BullMQ worker
 * takes over).
 */
@Injectable()
export class SyncWorkerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SyncWorkerService.name);
  private readonly handlers: Map<string, SyncJobHandler>;
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private timer?: NodeJS.Timeout;
  private ticking = false;

  constructor(
    private readonly queue: SyncQueueService,
    configService: ConfigService,
    @Inject(SYNC_JOB_HANDLERS) handlers: SyncJobHandler[],
  ) {
    this.handlers = new Map(handlers.map((h) => [h.type, h]));
    this.enabled = configService.get<string>('SYNC_WORKER_ENABLED', 'true') !== 'false';
    this.intervalMs = configService.get<number>('SYNC_WORKER_INTERVAL_MS', 5_000);
    this.batchSize = configService.get<number>('SYNC_WORKER_BATCH_SIZE', 10);
  }

  onApplicationBootstrap(): void {
    if (!this.enabled) {
      this.logger.log('Sync worker disabled (SYNC_WORKER_ENABLED=false)');
      return;
    }
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    // Don't keep the event loop alive just for the poller.
    this.timer.unref?.();
    this.logger.log(
      `Sync worker started (interval ${this.intervalMs}ms, batch ${this.batchSize}, handlers: ${[...this.handlers.keys()].join(', ')})`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** One polling cycle. Guarded so cycles never overlap. */
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.queue.reclaimStaleJobs();
      const jobs = await this.queue.claimDueJobs(this.batchSize);
      for (const job of jobs) {
        await this.process(job);
      }
    } catch (err) {
      this.logger.error(`Sync worker tick failed: ${(err as Error).message}`);
    } finally {
      this.ticking = false;
    }
  }

  private async process(job: SyncJob): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      await this.queue.markFailed(job, `No handler registered for job type ${job.type}`);
      return;
    }
    try {
      const outcome = await handler.handle({
        id: job.id,
        tenantId: job.tenantId,
        type: job.type,
        entityType: job.entityType,
        entityId: job.entityId,
        attempt: job.attempts,
      });
      if (outcome.success) {
        await this.queue.markSucceeded(job.id);
      } else {
        await this.queue.markFailed(job, outcome.message ?? 'Sync failed');
      }
    } catch (err) {
      // Handlers own their errors, but guard against anything unexpected.
      await this.queue.markFailed(job, (err as Error).message);
    }
  }
}
