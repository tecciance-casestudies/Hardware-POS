'use client';

import Link from 'next/link';
import {
  Banknote,
  FileText,
  PauseCircle,
  Plus,
  Receipt,
  ScanLine,
  ShoppingCart,
  Undo2,
  UserPlus,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import * as React from 'react';

import { ProductImage } from '@/components/product-image';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import type { Session } from '@/lib/auth';
import { paymentStatusMeta } from '@/lib/dashboard/adapters';
import {
  demoFrequentItems,
  demoPaymentBreakdown,
  demoShiftSummary,
  demoSpark,
  demoTopCategories,
} from '@/lib/dashboard/demo';
import type { DashboardMetric } from '@/lib/dashboard/types';
import { useDashboardData } from '@/lib/dashboard/use-dashboard-data';
import { Permission } from '@/lib/permissions';
import { cn, formatMoney } from '@/lib/utils';

import {
  CardSkeleton,
  DemoBadge,
  EmptyState,
  KpiSkeleton,
  MetricCard,
  ProgressBar,
  SectionCard,
  StatusPill,
  ViewAllLink,
} from './primitives';

export function CashierDashboard({
  session,
  hasPermission,
}: {
  session: Session;
  hasPermission: (p: Permission) => boolean;
}) {
  const data = useDashboardData(session);
  const canReturn = hasPermission(Permission.RETURN_CREATE);
  const canQuote = hasPermission(Permission.QUOTATION_CREATE);
  const canAddCustomer = hasPermission(Permission.CUSTOMER_MANAGE);

  const todaySales = data.stats?.todaySalesTotal ?? 0;
  const txns = data.stats?.todayTransactions ?? 0;
  const avgBill = txns > 0 ? todaySales / txns : 0;
  const shift = demoShiftSummary();

  const kpis: { metric: DashboardMetric; icon: LucideIcon }[] = [
    {
      icon: Wallet,
      metric: {
        id: 'today-sales',
        label: "Today's Sales",
        value: formatMoney(todaySales),
        helpText: 'Total value of sales you completed today.',
        spark: demoSpark('up'),
        destination: '/sales',
      },
    },
    {
      icon: Receipt,
      metric: {
        id: 'txns-today',
        label: 'Transactions Today',
        value: txns.toLocaleString(),
        helpText: 'Number of sales completed today.',
        spark: demoSpark('steady'),
        destination: '/sales',
      },
    },
    {
      icon: ShoppingCart,
      metric: {
        id: 'avg-bill',
        label: 'Average Bill',
        value: formatMoney(avgBill),
        helpText: "Today's sales divided by today's transactions.",
      },
    },
    {
      icon: Banknote,
      metric: {
        id: 'drawer',
        label: 'Cash Drawer Balance',
        value: formatMoney(shift.drawerBalance),
        helpText: 'Current expected cash in your drawer.',
        isDemo: true,
      },
    },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CashierHeader name={session.user.name} canReturn={canReturn} canQuote={canQuote} />

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.loading && !data.stats ? (
          <KpiSkeleton count={4} />
        ) : (
          kpis.map(({ metric, icon }) => <MetricCard key={metric.id} metric={metric} icon={icon} />)
        )}
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-1 2xl:col-span-1">
          <RecentSalesCard data={data} />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <QuickAccessCard canAddCustomer={canAddCustomer} canQuote={canQuote} />
          <PaymentMethodsCard />
        </div>
        <ShiftSummaryCard shift={shift} />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <TopCategoriesCard />
        <FrequentlySoldItemsCard />
      </div>

      <p className="pb-2 text-center text-xs text-muted-foreground">
        All amounts are in Sri Lankan Rupees (LKR)
      </p>
    </div>
  );
}

function CashierHeader({
  name,
  canReturn,
  canQuote,
}: {
  name: string;
  canReturn: boolean;
  canQuote: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {name} 👋</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening at your register today.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/pos" className={buttonVariants({ size: 'md' })}>
          <Plus className="h-4 w-4" />
          Start New Sale
        </Link>
        {canReturn ? (
          <Link href="/returns/new" className={buttonVariants({ variant: 'outline', size: 'md' })}>
            <Undo2 className="h-4 w-4" />
            Return
          </Link>
        ) : null}
        {canQuote ? (
          <Link
            href="/quotations/new"
            className={buttonVariants({ variant: 'outline', size: 'md' })}
          >
            <FileText className="h-4 w-4" />
            Quote
          </Link>
        ) : null}
        {/* Held sales have no backing feature yet — shown disabled, not faked. */}
        <Tooltip label="Held sales aren't available yet">
          <span
            className={cn(
              buttonVariants({ variant: 'outline', size: 'md' }),
              'cursor-not-allowed opacity-50',
            )}
            aria-disabled
          >
            <PauseCircle className="h-4 w-4" />
            Hold Sales
          </span>
        </Tooltip>
      </div>
    </div>
  );
}

function RecentSalesCard({ data }: { data: ReturnType<typeof useDashboardData> }) {
  return (
    <SectionCard title="Recent Sales" className="h-full" action={<ViewAllLink href="/sales" />}>
      {data.loading && data.recentSales.length === 0 ? (
        <CardSkeleton rows={6} />
      ) : data.recentSales.length === 0 ? (
        <EmptyState message="No sales have been completed during this shift." />
      ) : (
        <ul className="divide-y divide-border">
          {data.recentSales.slice(0, 6).map((s) => {
            const meta = paymentStatusMeta(s.paymentStatus, s.returnStatus);
            const time = new Date(s.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <li key={s.id}>
                <Link
                  href={`/sales/${s.id}`}
                  className="flex items-center gap-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">
                    {time}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {s.customerName ?? 'Walk-in Customer'}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.saleNumber}
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

interface QuickAction {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  primary?: boolean;
  disabledReason?: string;
}

function QuickAccessCard({
  canAddCustomer,
  canQuote,
}: {
  canAddCustomer: boolean;
  canQuote: boolean;
}) {
  const actions: QuickAction[] = [
    { key: 'new-sale', label: 'New Sale', icon: ShoppingCart, href: '/pos', primary: true },
    { key: 'scan', label: 'Scan Barcode', icon: ScanLine, href: '/pos' },
    ...(canAddCustomer
      ? [{ key: 'add-customer', label: 'Add Customer', icon: UserPlus, href: '/customers/new' }]
      : []),
    {
      key: 'resume-hold',
      label: 'Resume Hold',
      icon: PauseCircle,
      disabledReason: "Held sales aren't available yet",
    },
    ...(canQuote
      ? [
          {
            key: 'create-quote',
            label: 'Create Quotation',
            icon: FileText,
            href: '/quotations/new',
          },
        ]
      : []),
  ];
  return (
    <SectionCard title="Quick Access">
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => {
          const inner = (
            <>
              <a.icon className="h-5 w-5" aria-hidden />
              <span className="text-sm font-medium">{a.label}</span>
            </>
          );
          const base =
            'flex min-h-[3.25rem] flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1';
          if (a.disabledReason) {
            return (
              <Tooltip key={a.key} label={a.disabledReason} className="w-full">
                <span
                  className={cn(
                    base,
                    'w-full cursor-not-allowed border-border text-muted-foreground opacity-60',
                  )}
                  aria-disabled
                >
                  {inner}
                </span>
              </Tooltip>
            );
          }
          return (
            <Link
              key={a.key}
              href={a.href ?? '#'}
              className={cn(
                base,
                a.primary
                  ? 'border-primary bg-brand-50 text-brand-700'
                  : 'border-border hover:bg-muted',
              )}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </SectionCard>
  );
}

function ShiftSummaryCard({ shift }: { shift: ReturnType<typeof demoShiftSummary> }) {
  const diff = shift.difference;
  const diffLabel =
    diff === 0
      ? 'Balanced'
      : diff > 0
        ? `Over by ${formatMoney(diff)}`
        : `Short by ${formatMoney(-diff)}`;
  const diffTone = diff === 0 ? 'text-success' : diff > 0 ? 'text-warning' : 'text-danger';
  return (
    <SectionCard
      title="Shift Summary"
      badge={<DemoBadge />}
      className="h-full"
      action={
        <Badge variant={shift.isOpen ? 'success' : 'neutral'}>
          {shift.isOpen ? 'Open' : 'Closed'}
        </Badge>
      }
    >
      <dl className="space-y-2.5 text-sm">
        <SummaryRow label="Shift started" value={shift.startedAtLabel} />
        <SummaryRow label="Starting cash" value={formatMoney(shift.startingCash)} />
        <div className="my-1 border-t border-border" />
        <SummaryRow label="Cash sales" value={formatMoney(shift.cashSales)} />
        <SummaryRow label="Card sales" value={formatMoney(shift.cardSales)} />
        <SummaryRow label="Bank / QR sales" value={formatMoney(shift.bankQrSales)} />
        <SummaryRow
          label="Refunds (cash)"
          value={`- ${formatMoney(shift.refunds)}`}
          tone="danger"
        />
        <div className="my-1 border-t border-border" />
        <SummaryRow label="Expected cash" value={formatMoney(shift.expectedCash)} strong />
        <SummaryRow label="Drawer balance" value={formatMoney(shift.drawerBalance)} strong />
      </dl>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-muted px-3 py-2.5">
        <span className="text-sm text-muted-foreground">Current difference</span>
        <span className={cn('text-sm font-semibold', diffTone)}>{diffLabel}</span>
      </div>
    </SectionCard>
  );
}

function SummaryRow({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: 'danger';
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'tabular-nums',
          strong ? 'font-semibold' : 'font-medium',
          tone === 'danger' && 'text-danger',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function PaymentMethodsCard() {
  const rows = demoPaymentBreakdown();
  return (
    <SectionCard title="Payment Methods" badge={<DemoBadge />}>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.key} className="space-y-1">
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
      action={<ViewAllLink href="/products" />}
    >
      <ol className="grid gap-2.5 sm:grid-cols-2">
        {rows.slice(0, 4).map((r, i) => (
          <li key={r.key} className="flex items-center gap-3 rounded-xl border border-border p-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{r.label}</span>
              <span className="block text-xs tabular-nums text-muted-foreground">
                {formatMoney(r.amount)} · {r.percent}%
              </span>
            </span>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

function FrequentlySoldItemsCard() {
  const items = demoFrequentItems();
  return (
    <SectionCard
      title="Frequently Sold Items"
      badge={<DemoBadge />}
      action={<ViewAllLink href="/products" />}
    >
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {items.map((it) => (
          <li
            key={it.key}
            className="flex items-center gap-3 rounded-xl border border-border p-2.5"
          >
            <ProductImage src={it.imageUrl} alt={it.name} className="h-10 w-10 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{it.name}</span>
              <span className="block text-xs text-muted-foreground">
                Qty: {it.quantity} · {formatMoney(it.amount)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
