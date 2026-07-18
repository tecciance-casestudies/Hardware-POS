'use client';

import * as React from 'react';

import type { Session } from '@/lib/auth';
import {
  fetchDashboardStats,
  fetchDashboardSummary,
  fetchPaymentMethods,
  fetchShiftSummary,
  fetchTopCategories,
  fetchTopProducts,
  type DashboardStats,
  type DashboardSummary,
  type PaymentMethodTotal,
  type RankedCategoryApi,
  type RankedProductApi,
  type ShiftSummaryApi,
} from '@/lib/dashboard-api';
import { fetchStockCounts, type StockCounts } from '@/lib/products-api';
import { fetchQuotations, type QuotationListItem } from '@/lib/quotations';
import { fetchSales, type SaleListItem } from '@/lib/sales';

import { buildQuickBooksHealth, buildQuotationPipeline } from './adapters';

/** How often the dashboard re-fetches while the tab is visible. */
const POLL_INTERVAL_MS = 30_000;

export interface DashboardData {
  loading: boolean;
  error: string | null;
  /** Timestamp label of the last successful load (client-only, avoids SSR drift). */
  lastUpdatedLabel: string | null;
  refresh: () => void;
  stats: DashboardStats | null;
  recentSales: SaleListItem[];
  quotations: QuotationListItem[];
  /** Out-of-stock / low-stock counts, matching the products table filters. */
  stock: StockCounts;
  pipeline: ReturnType<typeof buildQuotationPipeline>;
  quickbooks: ReturnType<typeof buildQuickBooksHealth>;
  /** 7-day KPI window with previous-period comparison (real aggregates). */
  summary: DashboardSummary | null;
  /** Payment split — tenant-wide for admin, the user's own for cashier. */
  paymentMethods: PaymentMethodTotal[];
  topCategories: RankedCategoryApi[];
  /** Cashier variant only: the user's best-selling items. */
  frequentItems: RankedProductApi[];
  /** Cashier variant only: today's own activity. */
  shift: ShiftSummaryApi | null;
}

/**
 * Single data source for both dashboards. Fetches only what real endpoints
 * expose (stats, recent sales, quotations, products for stock) with
 * `Promise.allSettled` so one failing panel never blanks the whole page. Polls
 * while the tab is visible and exposes a manual `refresh()`.
 */
export function useDashboardData(
  session: Session,
  variant: 'admin' | 'cashier' = 'admin',
): DashboardData {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = React.useState<SaleListItem[]>([]);
  const [quotations, setQuotations] = React.useState<QuotationListItem[]>([]);
  const [stock, setStock] = React.useState<StockCounts>({ outOfStock: 0, lowStock: 0 });
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethodTotal[]>([]);
  const [topCategories, setTopCategories] = React.useState<RankedCategoryApi[]>([]);
  const [frequentItems, setFrequentItems] = React.useState<RankedProductApi[]>([]);
  const [shift, setShift] = React.useState<ShiftSummaryApi | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdatedLabel, setLastUpdatedLabel] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  const refresh = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    let cancelled = false;
    const mine = variant === 'cashier';

    const load = async () => {
      const [
        statsRes,
        salesRes,
        quotesRes,
        stockRes,
        summaryRes,
        paymentsRes,
        categoriesRes,
        frequentRes,
        shiftRes,
      ] = await Promise.allSettled([
        fetchDashboardStats(session),
        fetchSales(session, { pageSize: 8 }),
        fetchQuotations(session, { pageSize: 100 }),
        fetchStockCounts(session),
        fetchDashboardSummary(session),
        fetchPaymentMethods(session, { mine }),
        fetchTopCategories(session, 5),
        mine ? fetchTopProducts(session, { limit: 6, mine: true }) : Promise.resolve([]),
        mine ? fetchShiftSummary(session) : Promise.resolve(null),
      ]);
      if (cancelled) return;

      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (salesRes.status === 'fulfilled') setRecentSales(salesRes.value.items);
      if (quotesRes.status === 'fulfilled') setQuotations(quotesRes.value.items);
      if (stockRes.status === 'fulfilled') setStock(stockRes.value);
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
      if (paymentsRes.status === 'fulfilled') setPaymentMethods(paymentsRes.value);
      if (categoriesRes.status === 'fulfilled') setTopCategories(categoriesRes.value);
      if (frequentRes.status === 'fulfilled') setFrequentItems(frequentRes.value);
      if (shiftRes.status === 'fulfilled') setShift(shiftRes.value);

      // Only surface an error banner when everything failed — a single failed
      // panel degrades to its own empty/error state instead.
      const core = [statsRes, salesRes, quotesRes, stockRes, summaryRes];
      const allFailed = core.every((r) => r.status === 'rejected');
      if (allFailed) {
        const first = core.find((r) => r.status === 'rejected') as
          | PromiseRejectedResult
          | undefined;
        setError(
          first?.reason instanceof Error ? first.reason.message : 'Could not load dashboard',
        );
      } else {
        setError(null);
        setLastUpdatedLabel(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        );
      }
      setLoading(false);
    };

    const loadIfVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };

    void load();
    const timer = window.setInterval(loadIfVisible, POLL_INTERVAL_MS);
    window.addEventListener('focus', loadIfVisible);
    document.addEventListener('visibilitychange', loadIfVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', loadIfVisible);
      document.removeEventListener('visibilitychange', loadIfVisible);
    };
  }, [session, tick, variant]);

  const pipeline = React.useMemo(() => buildQuotationPipeline(quotations), [quotations]);
  const failedSyncs = React.useMemo(
    () => recentSales.filter((s) => s.syncStatus === 'FAILED').length,
    [recentSales],
  );
  const quickbooks = React.useMemo(
    () => buildQuickBooksHealth(stats, failedSyncs),
    [stats, failedSyncs],
  );

  return {
    loading,
    error,
    lastUpdatedLabel,
    refresh,
    stats,
    recentSales,
    quotations,
    stock,
    pipeline,
    quickbooks,
    summary,
    paymentMethods,
    topCategories,
    frequentItems,
    shift,
  };
}
