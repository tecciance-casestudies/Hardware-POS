/** A metric value with its previous-period counterpart and daily sparkline. */
export interface RangedMetric {
  value: number;
  prevValue: number;
  /** Per-day values across the window (sparkline material). */
  series: number[];
}

/** KPI aggregates for a date window, with previous-window comparisons. */
export interface DashboardSummary {
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  netSales: RangedMetric;
  transactions: RangedMetric;
  /** Revenue minus known product costs (upper bound while costs are partial). */
  grossProfit: RangedMetric;
  avgSale: { value: number; prevValue: number };
}

export interface SeriesPoint {
  bucket: string;
  value: number;
}

export interface PaymentMethodTotal {
  method: string;
  amount: number;
}

export interface RankedCategory {
  label: string;
  amount: number;
}

export interface RankedProduct {
  productId: string | null;
  name: string;
  imageUrl: string | null;
  quantity: number;
  amount: number;
}

/** The signed-in cashier's activity since local midnight. */
export interface ShiftSummary {
  startedAt: string | null;
  transactions: number;
  cashSales: number;
  cardSales: number;
  bankQrSales: number;
  otherSales: number;
  refunds: number;
  /** Cash expected in the drawer from sales (no drawer-session tracking yet). */
  expectedCash: number;
}

/** Aggregated store-activity numbers for the dashboard tiles. */
export interface DashboardStats {
  /** Sum of completed sale totals since local midnight. */
  todaySalesTotal: number;
  /** Number of completed sales since local midnight. */
  todayTransactions: number;
  /** Active products in the local catalog cache. */
  productsCached: number;
  /** Completed sales not yet pushed to QuickBooks (pending, syncing, or failed). */
  pendingSyncs: number;
}
