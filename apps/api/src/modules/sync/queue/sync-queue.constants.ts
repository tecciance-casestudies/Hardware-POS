/**
 * Shared constants for the sync queue.
 *
 * The queue is intentionally a thin, DB-backed abstraction: completed sales write
 * a `SyncJob` row (a transactional outbox) and a polling worker drains it. The
 * boundaries here (job types, the handler contract, the queue service) are the
 * seams to swap the polling worker for BullMQ/Redis later without touching the
 * producers (sale completion) or the domain handlers.
 */

/** DI token for the array of registered {@link SyncJobHandler}s. */
export const SYNC_JOB_HANDLERS = Symbol('SYNC_JOB_HANDLERS');

/** Job type discriminator stored on `SyncJob.type`. */
export const SyncJobType = {
  SALES_SYNC: 'SALES_SYNC',
} as const;
export type SyncJobType = (typeof SyncJobType)[keyof typeof SyncJobType];

export const SyncDirection = {
  OUTBOUND: 'OUTBOUND',
  INBOUND: 'INBOUND',
} as const;

export const SyncEntityType = {
  SALE: 'SALE',
  PRODUCT: 'PRODUCT',
} as const;
