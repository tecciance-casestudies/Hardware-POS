/**
 * Contract a sync-job handler implements. The worker resolves a handler by
 * `type` and calls `handle`; handlers do the domain work and report success or
 * failure. They must not manage the `SyncJob` lifecycle — the queue owns that —
 * which is what lets the polling worker be replaced by a BullMQ worker later.
 */

export interface SyncJobContext {
  id: string;
  tenantId: string;
  type: string;
  entityType: string;
  entityId: string | null;
  /** 1-based attempt number for this run (already incremented by the claim). */
  attempt: number;
}

export interface SyncJobOutcome {
  success: boolean;
  message?: string;
}

export interface SyncJobHandler {
  /** The `SyncJob.type` this handler processes (see {@link SyncJobType}). */
  readonly type: string;
  handle(job: SyncJobContext): Promise<SyncJobOutcome>;
}
