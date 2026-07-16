'use client';

import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  ChevronRight,
  FileText,
  Info,
  PackagePlus,
  Plus,
  Receipt,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import * as React from 'react';

import { buttonVariants } from '@/components/ui/button';
import type { Session } from '@/lib/auth';
import { paymentStatusMeta } from '@/lib/dashboard/adapters';
import {
  demoComparison,
  demoGrossProfit,
  demoPaymentBreakdown,
  demoSalesSeries,
  demoSpark,
  demoTopCategories,
} from '@/lib/dashboard/demo';
import { useDashboardData } from '@/lib/dashboard/use-dashboard-data';
import type { AlertItem, DashboardMetric } from '@/lib/dashboard/types';
import { Permission, type UserRole } from '@/lib/permissions';
import { formatMoney, cn } from '@/lib/utils';

import {
  CardSkeleton,
  DemoBadge,
  EmptyState,
  KpiSkeleton,
  KPIGrid,
  MiniBarChart,
  ProgressBar,
  SectionCard,
  StatusPill,
  ViewAllLink,
  type MetricSpec,
} from './primitives';

const RANGES = ['7D', '30D', '3M', '6M', '1Y'] as const;
type Range = (typeof RANGES)[number];

export function AdminDashboard({
  session,
  hasPermission,
}: {
  session: Session;
  hasPermission: (p: Permission) => boolean;
}) {
  const data = useDashboardData(session);
  const canReport = hasPermission(Permission.REPORT_READ);
  const canManageProducts = hasPermission(Permission.PRODUCT_MANAGE);

  const netSales = data.stats?.todaySalesTotal ?? 0;
  const txns = data.stats?.todayTransactions ?? 0;
  const aov = txns > 0 ? netSales / txns : 0;

  const kpis: MetricSpec[] = [
    {
      icon: TrendingUp,
      metric: {
        id: 'net-sales',
        label: 'Net Sales',
        value: formatMoney(netSales),
        helpText: "Total value of today's completed sales.",
        comparison: demoComparison(18.4, 'vs last period'),
        spark: demoSpark('up'),
        destination: '/sales',
        isDemo: true,
      },
    },
    ...(canReport
      ? [
          {
            icon: BarChart3,
            metric: {
              id: 'gross-profit',
              label: 'Gross Profit',
              value: formatMoney(demoGrossProfit(netSales)),
              helpText: 'Estimated margin. Requires verified product cost data.',
              comparison: demoComparison(15.7, 'vs last period'),
              spark: demoSpark('up'),
              destination: '/sales',
              isDemo: true,
            } satisfies DashboardMetric,
          },
        ]
      : []),
    {
      icon: Receipt,
      metric: {
        id: 'transactions',
        label: 'Transactions',
        value: txns.toLocaleString(),
        helpText: 'Number of sales completed today.',
        footnote: `${txns.toLocaleString()} completed today`,
        destination: '/sales',
      },
    },
    {
      icon: ShoppingCart,
      metric: {
        id: 'aov',
        label: 'Average Order Value',
        value: formatMoney(aov),
        helpText: "Today's sales divided by today's transactions.",
        footnote: `Across ${txns.toLocaleString()} sales today`,
        destination: '/sales',
      },
    },
    {
      icon: FileText,
      metric: {
        id: 'open-quotations',
        label: 'Open Quotations',
        value: data.pipeline.openCount.toLocaleString(),
        helpText: 'Draft and sent quotations awaiting a decision.',
        footnote: 'Awaiting a decision',
        destination: '/quotations',
      },
    },
  ];

  const alerts = buildAdminAlerts(data);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <AdminHeader
        lastUpdated={data.lastUpdatedLabel}
        onRefresh={data.refresh}
        loading={data.loading}
        canManageProducts={canManageProducts}
        canReport={canReport}
      />

      {/* KPI grid — container-aware 5 / 3+2 / 2 / 1 layout (no orphan card) */}
      {data.loading && !data.stats ? (
        <div className="@container">
          <div className="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2 @min-[1050px]:grid-cols-3 @min-[1400px]:grid-cols-5">
            <KpiSkeleton count={5} />
          </div>
        </div>
      ) : (
        <KPIGrid metrics={kpis} />
      )}

      {/* Analytics row: sales performance | quickbooks | alerts */}
      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-1 2xl:col-span-1">
          <SalesPerformance />
        </div>
        <QuickBooksHealthCard health={data.quickbooks} />
        <AdminAlerts alerts={alerts} loading={data.loading && !data.stats} />
      </div>

      {/* Secondary analytics row */}
      <div className="grid min-w-0 gap-4 xl:grid-cols-2 2xl:grid-cols-4">
        <PaymentMethodsCard />
        <TopCategoriesCard />
        <QuotationPipelineCard
          pipeline={data.pipeline}
          loading={data.loading && !data.quotations.length}
        />
        <RecentTransactionsCard data={data} />
      </div>

      <p className="pb-2 text-center text-xs text-muted-foreground">
        All amounts are in Sri Lankan Rupees (LKR)
      </p>
    </div>
  );
}

function AdminHeader({
  lastUpdated,
  onRefresh,
  loading,
  canManageProducts,
  canReport,
}: {
  lastUpdated: string | null;
  onRefresh: () => void;
  loading: boolean;
  canManageProducts: boolean;
  canReport: boolean;
}) {
  return (
    // Stacks on laptop/tablet (title row, then actions row); single row on wide
    // desktop. Actions wrap within their own group so they never overflow.
    <div className="flex min-w-0 flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Business Overview</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Real-time summary of your business performance.
          {lastUpdated ? <span className="ml-1">Updated {lastUpdated}.</span> : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 2xl:justify-end">
        <Link href="/pos" className={buttonVariants({ size: 'md' })}>
          <Plus className="h-4 w-4" />
          New Sale
        </Link>
        <Link href="/quotations/new" className={buttonVariants({ variant: 'outline', size: 'md' })}>
          <FileText className="h-4 w-4" />
          Create Quote
        </Link>
        {canManageProducts ? (
          <Link href="/products/new" className={buttonVariants({ variant: 'outline', size: 'md' })}>
            <PackagePlus className="h-4 w-4" />
            Add Product
          </Link>
        ) : null}
        {canReport ? (
          <Link href="/sales" className={buttonVariants({ variant: 'outline', size: 'md' })}>
            <BarChart3 className="h-4 w-4" />
            View Reports
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh dashboard"
          className={buttonVariants({ variant: 'outline', size: 'icon-md' })}
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>
    </div>
  );
}

function SalesPerformance() {
  const [range, setRange] = React.useState<Range>('7D');
  const series = demoSalesSeries();
  const total = series.reduce((s, d) => s + d.value, 0);
  return (
    <SectionCard
      title="Sales Performance"
      badge={<DemoBadge />}
      className="h-full"
      action={
        <div role="tablist" aria-label="Sales performance range" className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={range === r}
              onClick={() => setRange(r)}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                range === r ? 'bg-brand-50 text-brand-700' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-xl font-bold tracking-tight">{formatMoney(total)}</span>
        <span className="flex items-center gap-1 text-xs font-medium text-success">
          <TrendingUp className="h-3.5 w-3.5" /> +18.4%{' '}
          <span className="font-normal text-muted-foreground">this {range}</span>
        </span>
      </div>
      <MiniBarChart data={series} ariaLabel={`Net sales for the selected ${range} period`} />
    </SectionCard>
  );
}

function QuickBooksHealthCard({
  health,
}: {
  health: ReturnType<typeof useDashboardData>['quickbooks'];
}) {
  const dotTone =
    health.status === 'danger'
      ? 'bg-danger'
      : health.status === 'warning'
        ? 'bg-warning'
        : 'bg-success';
  return (
    <SectionCard title="QuickBooks Integration Health" className="h-full">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', dotTone)} aria-hidden />
          <span className="text-sm font-semibold">
            {health.state === 'connected' ? 'Connected' : 'Disconnected'}
          </span>
          <span className="text-sm text-muted-foreground">· {health.statusLabel}</span>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Waiting to sync</dt>
            <dd
              className={cn(
                'font-semibold tabular-nums',
                health.waitingToSync > 0 && 'text-warning',
              )}
            >
              {health.waitingToSync}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Failed syncs (recent)</dt>
            <dd
              className={cn('font-semibold tabular-nums', health.failedSyncs > 0 && 'text-danger')}
            >
              {health.failedSyncs}
            </dd>
          </div>
        </dl>
        <Link
          href="/quickbooks"
          className={buttonVariants({ variant: 'outline', size: 'sm', fullWidth: true })}
        >
          Go to QuickBooks
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </SectionCard>
  );
}

const SEVERITY_ICON: Record<AlertItem['severity'], LucideIcon> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};
const SEVERITY_TONE: Record<AlertItem['severity'], string> = {
  critical: 'text-danger',
  warning: 'text-warning',
  info: 'text-primary',
};

function AdminAlerts({ alerts, loading }: { alerts: AlertItem[]; loading: boolean }) {
  return (
    <SectionCard
      title="Business Alerts"
      className="h-full"
      action={<ViewAllLink href="/products" />}
    >
      {loading ? (
        <CardSkeleton rows={3} />
      ) : alerts.length === 0 ? (
        <EmptyState message="All clear — no alerts need your attention right now." />
      ) : (
        <ul className="space-y-1">
          {alerts.map((a) => {
            const Icon = SEVERITY_ICON[a.severity];
            return (
              <li key={a.id}>
                <Link
                  href={a.destination}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon className={cn('h-5 w-5 shrink-0', SEVERITY_TONE[a.severity])} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {a.description}
                    </span>
                  </span>
                  {a.badge ? (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">
                      {a.badge}
                    </span>
                  ) : null}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

function PaymentMethodsCard() {
  const rows = demoPaymentBreakdown();
  return (
    <SectionCard title="Payment Methods" badge={<DemoBadge />} className="h-full">
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.key} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatMoney(r.amount)} · {r.percent}%
              </span>
            </div>
            <ProgressBar percent={r.percent} tone={r.tone} />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function TopCategoriesCard() {
  const rows = demoTopCategories();
  return (
    <SectionCard
      title="Top Categories"
      badge={<DemoBadge />}
      className="h-full"
      action={<ViewAllLink href="/products" />}
    >
      <ol className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                  {i + 1}
                </span>
                <span className="truncate font-medium">{r.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatMoney(r.amount)}
              </span>
            </div>
            <ProgressBar percent={r.percent} tone="primary" />
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

function QuotationPipelineCard({
  pipeline,
  loading,
}: {
  pipeline: ReturnType<typeof useDashboardData>['pipeline'];
  loading: boolean;
}) {
  return (
    <SectionCard
      title="Quotation Pipeline"
      className="h-full"
      action={<ViewAllLink href="/quotations" />}
    >
      {loading ? (
        <CardSkeleton rows={4} />
      ) : pipeline.totalCount === 0 ? (
        <EmptyState message="No quotations in the current window." />
      ) : (
        <ul className="space-y-2.5 text-sm">
          {pipeline.stages.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', dotFor(s.tone))} aria-hidden />
                {s.label}
              </span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums text-muted-foreground">{formatMoney(s.value)}</span>
                <span className="w-6 text-right font-semibold tabular-nums">{s.count}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function dotFor(tone: string): string {
  return (
    {
      muted: 'bg-slate-400',
      primary: 'bg-primary',
      warning: 'bg-warning',
      success: 'bg-success',
      danger: 'bg-danger',
    }[tone] ?? 'bg-slate-400'
  );
}

function RecentTransactionsCard({ data }: { data: ReturnType<typeof useDashboardData> }) {
  return (
    <SectionCard
      title="Recent Transactions"
      className="h-full"
      action={<ViewAllLink href="/sales" />}
    >
      {data.loading && data.recentSales.length === 0 ? (
        <CardSkeleton rows={5} />
      ) : data.recentSales.length === 0 ? (
        <EmptyState message="No sales recorded yet." />
      ) : (
        <ul className="divide-y divide-border">
          {data.recentSales.slice(0, 5).map((s) => {
            const meta = paymentStatusMeta(s.paymentStatus, s.returnStatus);
            return (
              <li key={s.id}>
                <Link
                  href={`/sales/${s.id}`}
                  className="flex items-center gap-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.saleNumber}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.customerName ?? 'Walk-in Customer'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums">
                      {formatMoney(s.total)}
                    </span>
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

/** Real, actionable alerts from live data, sorted by severity. */
function buildAdminAlerts(data: ReturnType<typeof useDashboardData>): AlertItem[] {
  const alerts: AlertItem[] = [];
  if (data.stock.outOfStock > 0) {
    alerts.push({
      id: 'out-of-stock',
      severity: 'critical',
      title: 'Out-of-stock products',
      description: `${data.stock.outOfStock} products are out of stock`,
      badge: String(data.stock.outOfStock),
      actionLabel: 'Review products',
      destination: '/products',
    });
  }
  if (data.stock.lowStock > 0) {
    alerts.push({
      id: 'low-stock',
      severity: 'warning',
      title: 'Low-stock items',
      description: `${data.stock.lowStock} products need attention`,
      badge: String(data.stock.lowStock),
      actionLabel: 'Review products',
      destination: '/products',
    });
  }
  if (data.quickbooks.failedSyncs > 0) {
    alerts.push({
      id: 'failed-syncs',
      severity: 'critical',
      title: 'Failed QuickBooks syncs',
      description: `${data.quickbooks.failedSyncs} recent sales failed to sync`,
      badge: String(data.quickbooks.failedSyncs),
      actionLabel: 'Open QuickBooks',
      destination: '/quickbooks',
    });
  }
  if (data.quickbooks.waitingToSync > 0) {
    alerts.push({
      id: 'waiting-sync',
      severity: 'info',
      title: 'Records waiting to sync',
      description: `${data.quickbooks.waitingToSync} records queued for QuickBooks`,
      badge: String(data.quickbooks.waitingToSync),
      actionLabel: 'Open QuickBooks',
      destination: '/quickbooks',
    });
  }
  if (data.pipeline.openCount > 0) {
    alerts.push({
      id: 'open-quotes',
      severity: 'info',
      title: 'Open quotations',
      description: `${data.pipeline.openCount} quotations awaiting a decision`,
      badge: String(data.pipeline.openCount),
      actionLabel: 'Review quotations',
      destination: '/quotations',
    });
  }
  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

// Keep the role type import used (documents intended consumers of this view).
export type AdminDashboardRole = Extract<UserRole, 'OWNER' | 'ADMIN' | 'MANAGER' | 'ACCOUNTANT'>;
