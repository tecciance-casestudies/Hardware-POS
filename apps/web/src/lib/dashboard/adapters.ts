/** Pure transforms: raw API rows → dashboard view-models. No fetching here. */
import type { SaleReturnStatusCode } from '@hardware-pos/shared';

import type { ClientProduct } from '@/lib/catalog';
import type { QuotationListItem } from '@/lib/quotations';
import type { DashboardStats } from '@/lib/dashboard-api';
import type { PaymentStatusCode, SyncStatusCode } from '@/lib/sales';

import type { PipelineStage, QuickBooksHealth } from './types';

export const LOW_STOCK_THRESHOLD = 5;

export interface StockSummary {
  lowStock: number;
  outOfStock: number;
}

export function summarizeStock(products: { quantityOnHand: number }[]): StockSummary {
  let lowStock = 0;
  let outOfStock = 0;
  for (const p of products) {
    if (p.quantityOnHand <= 0) outOfStock += 1;
    else if (p.quantityOnHand <= LOW_STOCK_THRESHOLD) lowStock += 1;
  }
  return { lowStock, outOfStock };
}

export interface QuotationPipeline {
  stages: PipelineStage[];
  /** DRAFT + SENT. */
  openCount: number;
  totalValue: number;
  totalCount: number;
}

const PIPELINE_DEF: { key: string; label: string; tone: PipelineStage['tone']; match: string[] }[] =
  [
    { key: 'draft', label: 'Draft', tone: 'muted', match: ['DRAFT'] },
    { key: 'sent', label: 'Sent', tone: 'primary', match: ['SENT', 'REVISED'] },
    { key: 'accepted', label: 'Accepted', tone: 'success', match: ['ACCEPTED'] },
    { key: 'converted', label: 'Converted', tone: 'success', match: ['CONVERTED_TO_SALE'] },
    {
      key: 'expired',
      label: 'Expired',
      tone: 'danger',
      match: ['EXPIRED', 'REJECTED', 'CANCELLED'],
    },
  ];

export function buildQuotationPipeline(quotations: QuotationListItem[]): QuotationPipeline {
  const stages: PipelineStage[] = PIPELINE_DEF.map((def) => {
    const rows = quotations.filter((q) => def.match.includes(q.status));
    return {
      key: def.key,
      label: def.label,
      tone: def.tone,
      count: rows.length,
      value: rows.reduce((s, q) => s + q.grandTotal, 0),
    };
  });
  const openCount = quotations.filter((q) => q.status === 'DRAFT' || q.status === 'SENT').length;
  return {
    stages,
    openCount,
    totalValue: quotations.reduce((s, q) => s + q.grandTotal, 0),
    totalCount: quotations.length,
  };
}

export function buildQuickBooksHealth(
  stats: DashboardStats | null,
  failedSyncs: number,
): QuickBooksHealth {
  const waiting = stats?.pendingSyncs ?? 0;
  const status =
    failedSyncs > 0
      ? 'danger'
      : waiting > 0
        ? 'warning'
        : ('success' as QuickBooksHealth['status']);
  return {
    state: 'connected',
    status,
    statusLabel:
      failedSyncs > 0 ? 'Attention required' : waiting > 0 ? 'Delayed' : 'All systems operational',
    lastSyncLabel: null,
    waitingToSync: waiting,
    failedSyncs,
  };
}

// ── status → label / tone (used by transaction + sales tables) ───────────────

export function paymentStatusMeta(
  status: PaymentStatusCode,
  returnStatus?: SaleReturnStatusCode,
): { label: string; tone: 'success' | 'warning' | 'danger' | 'muted' } {
  if (returnStatus === 'FULLY_RETURNED' || returnStatus === 'PARTIALLY_RETURNED') {
    return { label: 'Returned', tone: 'danger' };
  }
  switch (status) {
    case 'PAID':
      return { label: 'Paid', tone: 'success' };
    case 'PARTIAL':
      return { label: 'Partial', tone: 'warning' };
    case 'REFUNDED':
      return { label: 'Refund', tone: 'danger' };
    default:
      return { label: 'Credit', tone: 'muted' };
  }
}

export function syncStatusMeta(status: SyncStatusCode): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'muted';
} {
  switch (status) {
    case 'SYNCED':
      return { label: 'Synced', tone: 'success' };
    case 'FAILED':
      return { label: 'Sync failed', tone: 'danger' };
    case 'PENDING':
    case 'SYNCING':
      return { label: 'Sync pending', tone: 'warning' };
    default:
      return { label: 'Not synced', tone: 'muted' };
  }
}
