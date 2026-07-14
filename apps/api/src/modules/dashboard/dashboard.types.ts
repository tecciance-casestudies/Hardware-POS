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
