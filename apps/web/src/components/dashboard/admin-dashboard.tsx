'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Boxes,
  Building2,
  CalendarRange,
  Clock3,
  FileText,
  Info,
  Link2,
  PackagePlus,
  Plus,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import * as React from 'react';

import { buttonVariants } from '@/components/ui/button';
import type { Session } from '@/lib/auth';
import {
  buildComparison,
  buildPaymentBreakdown,
  buildTopCategoryRows,
  paymentStatusMeta,
} from '@/lib/dashboard/adapters';
import { fetchSalesSeries } from '@/lib/dashboard-api';
import { firstNameOf, greetingFor } from '@/lib/dashboard/roles';
import { useDashboardData } from '@/lib/dashboard/use-dashboard-data';
import type { AlertItem } from '@/lib/dashboard/types';
import { Permission, type UserRole } from '@/lib/permissions';
import { cn, formatMoney } from '@/lib/utils';

import { AreaChart, type ChartPoint } from './charts';
import { DashboardHero, type HeroAction } from './hero';
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  KpiSkeleton,
  KPIGrid,
  ProgressBar,
  Reveal,
  SectionCard,
  SegmentedControl,
  StatusPill,
  ViewAllLink,
  type MetricSpec,
} from './primitives';

const RANGES = [
  { value: '1D', label: 'Today' },
  { value: '7D', label: '7D' },
  { value: '30D', label: '30D' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
] as const;
type Range = (typeof RANGES)[number]['value'];

const count = (n: number) => Math.round(n).toLocaleString();

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
  const canQuickBooks = hasPermission(Permission.QUICKBOOKS_READ);

  const netSales = data.stats?.todaySalesTotal ?? 0;
  const txns = data.stats?.todayTransactions ?? 0;
  const aov = txns > 0 ? netSales / txns : 0;
  const summary = data.summary;

  const kpis: MetricSpec[] = [
    {
      icon: TrendingUp,
      metric: {
        id: 'net-sales',
        label: 'Net Sales',
        value: formatMoney(netSales),
        rawValue: netSales,
        format: formatMoney,
        helpText: "Total value of today's completed sales.",
        comparison: summary
          ? buildComparison(summary.netSales.value, summary.netSales.prevValue)
          : undefined,
        spark: summary?.netSales.series,
        destination: '/sales',
      },
    },
    ...(canReport
      ? [
          {
            icon: BarChart3,
            metric: {
              id: 'gross-profit',
              label: 'Gross Profit',
              value: formatMoney(summary?.grossProfit.value ?? 0),
              rawValue: summary?.grossProfit.value ?? 0,
              format: formatMoney,
              helpText:
                'Last 7 days: revenue minus known product costs (items without a cost price count at full margin).',
              comparison: summary
                ? buildComparison(summary.grossProfit.value, summary.grossProfit.prevValue)
                : undefined,
              spark: summary?.grossProfit.series,
              destination: '/sales',
            },
          } satisfies MetricSpec,
        ]
      : []),
    {
      icon: Receipt,
      metric: {
        id: 'transactions',
        label: 'Transactions',
        value: count(txns),
        rawValue: txns,
        format: count,
        helpText: 'Number of sales completed today.',
        footnote: 'Completed today',
        destination: '/sales',
      },
    },
    {
      icon: ShoppingCart,
      metric: {
        id: 'aov',
        label: 'Average Order Value',
        value: formatMoney(aov),
        rawValue: aov,
        format: formatMoney,
        helpText: "Today's sales divided by today's transactions.",
        footnote: `Across ${count(txns)} sales today`,
        destination: '/sales',
      },
    },
    {
      icon: FileText,
      metric: {
        id: 'open-quotations',
        label: 'Open Quotations',
        value: count(data.pipeline.openCount),
        rawValue: data.pipeline.openCount,
        format: count,
        helpText: 'Draft and sent quotations awaiting a decision.',
        footnote: 'Awaiting a decision',
        destination: '/quotations',
      },
    },
  ];

  const secondary: HeroAction[] = [
    { key: 'quote', label: 'Create Quote', href: '/quotations/new', icon: FileText },
    ...(canManageProducts
      ? [{ key: 'product', label: 'Add Product', href: '/products/new', icon: PackagePlus }]
      : []),
    ...(canReport ? [{ key: 'reports', label: 'View Reports', href: '/sales', icon: BarChart3 }] : []),
  ];

  const alerts = buildAdminAlerts(data);
  const greeting = greetingFor(new Date().getHours());

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DashboardHero
        greeting={greeting}
        name={firstNameOf(session.user.name)}
        subtitle="Here's what's happening across your business today."
        meta={[
          { key: 'branch', icon: Building2, label: session.branchName },
          { key: 'window', icon: CalendarRange, label: 'Last 7 days' },
          ...(data.lastUpdatedLabel
            ? [{ key: 'updated', icon: Clock3, label: `Updated ${data.lastUpdatedLabel}` }]
            : []),
        ]}
        primary={{ key: 'sale', label: 'New Sale', href: '/pos', icon: Plus }}
        secondary={secondary}
        onRefresh={data.refresh}
        refreshing={data.loading}
      />

      {data.error && !data.stats ? (
        <SectionCard title="Dashboard unavailable">
          <ErrorState message={data.error} onRetry={data.refresh} />
        </SectionCard>
      ) : null}

      {/* KPI band */}
      {data.loading && !data.stats ? (
        <div className="@container">
          <div className="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2 @min-[1050px]:grid-cols-3 @min-[1400px]:grid-cols-5">
            <KpiSkeleton count={5} />
          </div>
        </div>
      ) : (
        <KPIGrid metrics={kpis} />
      )}

      {/* Row 2 — performance + attention */}
      <div className="grid min-w-0 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <SalesPerformance session={session} />
        </Reveal>
        <Reveal index={1} className="xl:col-span-4">
          <AdminAlerts alerts={alerts} loading={data.loading && !data.stats} />
        </Reveal>
      </div>

      {/* Row 3 — mix + rankings + integration */}
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Reveal>
          <PaymentMethodsCard rows={buildPaymentBreakdown(data.paymentMethods)} />
        </Reveal>
        <Reveal index={1}>
          <TopCategoriesCard rows={buildTopCategoryRows(data.topCategories)} />
        </Reveal>
        <Reveal index={2} className="md:col-span-2 xl:col-span-1">
          <QuickBooksHealthCard health={data.quickbooks} canOpen={canQuickBooks} />
        </Reveal>
      </div>

      {/* Row 4 — activity + inventory / pipeline */}
      <div className="grid min-w-0 gap-4 xl:grid-cols-12">
        <Reveal className="xl:col-span-8">
          <RecentActivityCard data={data} />
        </Reveal>
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
          <Reveal index={1}>
            <InventoryAttentionCard stock={data.stock} loading={data.loading && !data.stats} />
          </Reveal>
          <Reveal index={2}>
            <QuotationPipelineCard
              pipeline={data.pipeline}
              loading={data.loading && !data.quotations.length}
            />
          </Reveal>
        </div>
      </div>

      <p className="pb-2 text-center text-xs text-muted-foreground">
        All amounts are in Sri Lankan Rupees (Rs.)
      </p>
    </div>
  );
}

// ── Sales performance ────────────────────────────────────────────────────────

const RANGE_DEF: Record<Range, { days: number; interval: 'day' | 'hour'; label: string }> = {
  '1D': { days: 1, interval: 'hour', label: 'today' },
  '7D': { days: 7, interval: 'day', label: 'the last 7 days' },
  '30D': { days: 30, interval: 'day', label: 'the last 30 days' },
  '3M': { days: 90, interval: 'day', label: 'the last 3 months' },
  '6M': { days: 180, interval: 'day', label: 'the last 6 months' },
  '1Y': { days: 365, interval: 'day', label: 'the last year' },
};

function SalesPerformance({ session }: { session: Session }) {
  const router = useRouter();
  const [range, setRange] = React.useState<Range>('7D');
  const [points, setPoints] = React.useState<ChartPoint[]>([]);
  const [prev, setPrev] = React.useState<ChartPoint[] | null>(null);
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading');

  const load = React.useCallback(() => {
    const def = RANGE_DEF[range];
    const now = new Date();
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    if (def.interval === 'hour') {
      // today only
    } else {
      from.setDate(from.getDate() - (def.days - 1));
    }
    const prevFrom = new Date(from);
    prevFrom.setDate(prevFrom.getDate() - def.days);
    const prevTo = new Date(from);

    setState('loading');
    const fmt = (bucket: string) =>
      def.interval === 'hour'
        ? new Date(bucket).toLocaleTimeString('en-LK', { hour: '2-digit' })
        : new Date(bucket).toLocaleDateString('en-LK', { day: '2-digit', month: 'short' });

    Promise.allSettled([
      fetchSalesSeries(session, { from, interval: def.interval }),
      def.interval === 'day'
        ? fetchSalesSeries(session, { from: prevFrom, to: prevTo, interval: def.interval })
        : Promise.resolve([]),
    ])
      .then(([cur, pre]) => {
        if (cur.status === 'fulfilled') {
          setPoints(cur.value.map((p) => ({ label: fmt(p.bucket), value: p.value })));
          setState('ready');
        } else {
          setState('error');
        }
        setPrev(
          pre.status === 'fulfilled' && pre.value.length > 1
            ? pre.value.map((p) => ({ label: fmt(p.bucket), value: p.value }))
            : null,
        );
      })
      .catch(() => setState('error'));
  }, [session, range]);

  React.useEffect(() => {
    let cancelled = false;
    if (!cancelled) load();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const total = points.reduce((s, d) => s + d.value, 0);
  const def = RANGE_DEF[range];
  const prevTotal = prev?.reduce((s, d) => s + d.value, 0) ?? 0;
  const cmp = prev ? buildComparison(total, prevTotal, 'vs previous period') : undefined;

  return (
    <SectionCard
      title="Sales Performance"
      icon={TrendingUp}
      className="h-full"
      action={
        <SegmentedControl<Range>
          options={RANGES}
          value={range}
          onChange={setRange}
          ariaLabel="Sales performance range"
        />
      }
    >
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-bold tracking-tight tabular-nums">{formatMoney(total)}</span>
        <span className="text-xs text-muted-foreground">net sales · {def.label}</span>
        {cmp ? (
          <span
            className={cn(
              'text-xs font-semibold',
              cmp.direction === 'up'
                ? 'text-success'
                : cmp.direction === 'down'
                  ? 'text-danger'
                  : 'text-muted-foreground',
            )}
          >
            {cmp.value > 0 ? '+' : ''}
            {cmp.value}% {cmp.label}
          </span>
        ) : null}
      </div>
      {state === 'loading' ? (
        <div className="h-44 w-full animate-pulse rounded-xl bg-muted" />
      ) : state === 'error' ? (
        <ErrorState message="Couldn't load the sales chart." onRetry={load} />
      ) : points.length === 0 ? (
        <EmptyState
          message="No sales in this period yet — completed sales will chart here."
          action={
            <Link href="/pos" className={buttonVariants({ size: 'sm' })}>
              <Plus className="h-4 w-4" />
              New Sale
            </Link>
          }
        />
      ) : (
        <AreaChart
          points={points}
          comparison={prev}
          valueFormat={formatMoney}
          ariaSummary={`Net sales for ${def.label}: ${formatMoney(total)} total across ${points.length} points.`}
          onSelect={() => router.push('/sales')}
        />
      )}
    </SectionCard>
  );
}

// ── QuickBooks health ────────────────────────────────────────────────────────

function QuickBooksHealthCard({
  health,
  canOpen,
}: {
  health: ReturnType<typeof useDashboardData>['quickbooks'];
  canOpen: boolean;
}) {
  const tone =
    health.status === 'danger' ? 'danger' : health.status === 'warning' ? 'warning' : 'success';
  return (
    <SectionCard title="QuickBooks Health" icon={Link2} className="h-full">
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-success',
              )}
              aria-hidden
            />
            <span className="text-sm font-semibold">
              {health.state === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <StatusPill tone={tone}>{health.statusLabel}</StatusPill>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Waiting to sync</dt>
            <dd className={cn('font-semibold tabular-nums', health.waitingToSync > 0 && 'text-warning')}>
              {count(health.waitingToSync)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Failed syncs (recent)</dt>
            <dd className={cn('font-semibold tabular-nums', health.failedSyncs > 0 && 'text-danger')}>
              {count(health.failedSyncs)}
            </dd>
          </div>
        </dl>
        {canOpen ? (
          <Link
            href="/quickbooks"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm', fullWidth: true }), 'mt-auto')}
          >
            View sync log
          </Link>
        ) : null}
      </div>
    </SectionCard>
  );
}

// ── Business attention ───────────────────────────────────────────────────────

const SEVERITY_ICON: Record<AlertItem['severity'], LucideIcon> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};
const SEVERITY_TONE: Record<AlertItem['severity'], string> = {
  critical: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-brand-50 text-primary',
};

function AdminAlerts({ alerts, loading }: { alerts: AlertItem[]; loading: boolean }) {
  return (
    <SectionCard
      title="Business Attention"
      icon={AlertTriangle}
      className="h-full"
      badge={
        alerts.length > 0 ? (
          <span className="rounded-full bg-danger-soft px-1.5 py-0.5 text-[11px] font-semibold text-danger">
            {alerts.length}
          </span>
        ) : null
      }
    >
      {loading ? (
        <CardSkeleton rows={4} />
      ) : alerts.length === 0 ? (
        <EmptyState message="All clear — nothing needs your attention right now." />
      ) : (
        <ul className="space-y-1.5">
          {alerts.map((a) => {
            const Icon = SEVERITY_ICON[a.severity];
            return (
              <li key={a.id}>
                <Link
                  href={a.destination}
                  className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      SEVERITY_TONE[a.severity],
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
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
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

// ── Payment methods ──────────────────────────────────────────────────────────

function PaymentMethodsCard({ rows }: { rows: ReturnType<typeof buildPaymentBreakdown> }) {
  return (
    <SectionCard title="Payment Methods" icon={Wallet} className="h-full">
      {rows.length === 0 ? (
        <EmptyState message="No payments yet — the split appears as sales come in." />
      ) : (
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
      )}
    </SectionCard>
  );
}

// ── Top categories ───────────────────────────────────────────────────────────

function TopCategoriesCard({ rows }: { rows: ReturnType<typeof buildTopCategoryRows> }) {
  return (
    <SectionCard
      title="Top Categories"
      icon={Boxes}
      className="h-full"
      action={<ViewAllLink href="/products" />}
    >
      {rows.length === 0 ? (
        <EmptyState message="No category sales yet — rankings build as sales complete." />
      ) : (
        <ol className="space-y-3">
          {rows.map((r, i) => (
            <li key={r.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-50 text-xs font-semibold text-brand-700">
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
      )}
    </SectionCard>
  );
}

// ── Quotation pipeline ───────────────────────────────────────────────────────

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
      icon={FileText}
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
      muted: 'bg-[var(--gray-400)]',
      primary: 'bg-primary',
      warning: 'bg-warning',
      success: 'bg-success',
      danger: 'bg-danger',
    }[tone] ?? 'bg-[var(--gray-400)]'
  );
}

// ── Inventory attention ──────────────────────────────────────────────────────

function InventoryAttentionCard({
  stock,
  loading,
}: {
  stock: { outOfStock: number; lowStock: number };
  loading: boolean;
}) {
  const rows = [
    stock.outOfStock > 0
      ? {
          key: 'out',
          tone: 'danger' as const,
          title: 'Out of stock',
          count: stock.outOfStock,
          href: '/products?stockStatus=OUT',
        }
      : null,
    stock.lowStock > 0
      ? {
          key: 'low',
          tone: 'warning' as const,
          title: 'Low stock',
          count: stock.lowStock,
          href: '/products?stockStatus=LOW',
        }
      : null,
  ].filter(Boolean) as { key: string; tone: 'danger' | 'warning'; title: string; count: number; href: string }[];

  return (
    <SectionCard
      title="Inventory Attention"
      icon={Boxes}
      className="h-full"
      action={<ViewAllLink href="/products" />}
    >
      {loading ? (
        <CardSkeleton rows={2} />
      ) : rows.length === 0 ? (
        <EmptyState message="Stock levels look healthy — nothing below its alert threshold." />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key}>
              <Link
                href={r.href}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 transition-colors hover:border-brand-200 hover:bg-muted/50"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      r.tone === 'danger' ? 'bg-danger' : 'bg-warning',
                    )}
                    aria-hidden
                  />
                  <span className="text-sm font-medium">{r.title}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-lg font-bold tabular-nums">{r.count}</span>
                  <span className="text-xs text-muted-foreground">items</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ── Recent activity (responsive table → cards) ───────────────────────────────

function RecentActivityCard({ data }: { data: ReturnType<typeof useDashboardData> }) {
  const rows = data.recentSales.slice(0, 6);
  return (
    <SectionCard
      title="Recent Business Activity"
      icon={Receipt}
      className="h-full"
      action={<ViewAllLink href="/sales" />}
    >
      {data.loading && data.recentSales.length === 0 ? (
        <CardSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState message="No sales recorded yet." />
      ) : (
        <div className="@container">
          {/* Table on wider content widths */}
          <table className="hidden w-full text-sm @min-[560px]:table">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="pb-2 font-medium">Transaction</th>
                <th scope="col" className="pb-2 font-medium">Customer</th>
                <th scope="col" className="pb-2 text-right font-medium">Amount</th>
                <th scope="col" className="pb-2 text-right font-medium">Status</th>
                <th scope="col" className="pb-2 text-right font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((s) => {
                const meta = paymentStatusMeta(s.paymentStatus, s.returnStatus);
                return (
                  <tr key={s.id} className="group transition-colors hover:bg-muted/40">
                    <td className="py-2.5">
                      <Link href={`/sales/${s.id}`} className="font-medium hover:text-primary">
                        {s.saleNumber}
                      </Link>
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {s.customerName ?? 'Walk-in Customer'}
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">
                      {formatMoney(s.total)}
                    </td>
                    <td className="py-2.5 text-right">
                      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                    </td>
                    <td className="py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                      {new Date(s.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Card list on narrow content widths */}
          <ul className="divide-y divide-border @min-[560px]:hidden">
            {rows.map((s) => {
              const meta = paymentStatusMeta(s.paymentStatus, s.returnStatus);
              return (
                <li key={s.id}>
                  <Link href={`/sales/${s.id}`} className="flex items-center gap-3 py-2.5">
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
        </div>
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
      destination: '/products?stockStatus=OUT',
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
      destination: '/products?stockStatus=LOW',
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
