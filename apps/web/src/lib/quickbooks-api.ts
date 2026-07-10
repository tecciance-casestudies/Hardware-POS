import { api } from './api';
import type { Session } from './auth';

export interface SyncProductsSummary {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  total: number;
}

/**
 * Trigger a QuickBooks product sync. With a real session this calls
 * POST /quickbooks/sync-products; the offline demo returns a simulated summary.
 */
export async function syncQuickBooksProducts(session: Session): Promise<SyncProductsSummary> {
  if (session.token.startsWith('mock.')) {
    return { created: 0, updated: 10, skipped: 2, failed: 0, total: 12 };
  }
  return api.post<SyncProductsSummary>('/quickbooks/sync-products', undefined, {
    token: session.token,
    tenantId: session.user.tenantId,
  });
}
