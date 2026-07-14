'use client';

import Link from 'next/link';
import * as React from 'react';
import { Package, ReceiptText, RefreshCw, Wallet, type LucideIcon } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { fetchDashboardStats, type DashboardStats } from '@/lib/dashboard-api';
import { formatMoney } from '@/lib/utils';

interface StatTile {
  label: string;
  value: string;
  icon: LucideIcon;
}

function buildTiles(stats: DashboardStats | null): StatTile[] {
  return [
    {
      label: "Today's Sales",
      value: stats ? formatMoney(stats.todaySalesTotal) : '—',
      icon: Wallet,
    },
    {
      label: 'Transactions',
      value: stats ? String(stats.todayTransactions) : '—',
      icon: ReceiptText,
    },
    {
      label: 'Products Cached',
      value: stats ? String(stats.productsCached) : '—',
      icon: Package,
    },
    {
      label: 'Pending Syncs',
      value: stats ? String(stats.pendingSyncs) : '—',
      icon: RefreshCw,
    },
  ];
}

/** How often the dashboard re-fetches stats while the tab is visible. */
const POLL_INTERVAL_MS = 15_000;

export default function DashboardPage() {
  const { session } = useAuth();
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!session) return;
    let cancelled = false;

    const load = async () => {
      try {
        const s = await fetchDashboardStats(session);
        if (cancelled) return;
        setStats(s);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load stats');
      }
    };

    // Poll while visible; skip ticks in background tabs and catch up the
    // moment the tab becomes visible/focused again.
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
  }, [session]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${session?.user.name ?? ''}`}
        description="Overview of your store activity."
        actions={
          <Link href="/pos" className={buttonVariants()}>
            New Sale
          </Link>
        }
      />

      {error ? (
        <div className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          Couldn&apos;t load store stats: {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {buildTiles(stats).map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight">{s.value}</div>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <s.icon className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Products, sales, and customers are live from the Hardware POS API. Connect QuickBooks to
          sync the catalog and push completed sales automatically.
        </CardContent>
      </Card>
    </div>
  );
}
