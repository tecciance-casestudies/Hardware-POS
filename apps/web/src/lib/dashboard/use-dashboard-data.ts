'use client';

import * as React from 'react';

import type { Session } from '@/lib/auth';
import { fetchDashboardStats, type DashboardStats } from '@/lib/dashboard-api';
import { fetchProducts } from '@/lib/products-api';
import { fetchQuotations, type QuotationListItem } from '@/lib/quotations';
import { fetchSales, type SaleListItem } from '@/lib/sales';

import { buildQuickBooksHealth, buildQuotationPipeline, summarizeStock } from './adapters';

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
  stock: ReturnType<typeof summarizeStock>;
  pipeline: ReturnType<typeof buildQuotationPipeline>;
  quickbooks: ReturnType<typeof buildQuickBooksHealth>;
}

/**
 * Single data source for both dashboards. Fetches only what real endpoints
 * expose (stats, recent sales, quotations, products for stock) with
 * `Promise.allSettled` so one failing panel never blanks the whole page. Polls
 * while the tab is visible and exposes a manual `refresh()`.
 */
export function useDashboardData(session: Session): DashboardData {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = React.useState<SaleListItem[]>([]);
  const [quotations, setQuotations] = React.useState<QuotationListItem[]>([]);
  const [products, setProducts] = React.useState<{ quantityOnHand: number }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdatedLabel, setLastUpdatedLabel] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  const refresh = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [statsRes, salesRes, quotesRes, productsRes] = await Promise.allSettled([
        fetchDashboardStats(session),
        fetchSales(session, { pageSize: 8 }),
        fetchQuotations(session, { pageSize: 100 }),
        fetchProducts(session, { pageSize: 200 }),
      ]);
      if (cancelled) return;

      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (salesRes.status === 'fulfilled') setRecentSales(salesRes.value.items);
      if (quotesRes.status === 'fulfilled') setQuotations(quotesRes.value.items);
      if (productsRes.status === 'fulfilled') setProducts(productsRes.value.items);

      // Only surface an error banner when everything failed — a single failed
      // panel degrades to its own empty/error state instead.
      const allFailed = [statsRes, salesRes, quotesRes, productsRes].every(
        (r) => r.status === 'rejected',
      );
      if (allFailed) {
        const first = [statsRes, salesRes, quotesRes, productsRes].find(
          (r) => r.status === 'rejected',
        ) as PromiseRejectedResult | undefined;
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
  }, [session, tick]);

  const stock = React.useMemo(() => summarizeStock(products), [products]);
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
  };
}
