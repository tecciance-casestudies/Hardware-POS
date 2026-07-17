'use client';

import Link from 'next/link';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info, type LucideIcon } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import type { DashboardMetric } from '@/lib/dashboard/types';
import { cn } from '@/lib/utils';

/** Tiny inline-SVG sparkline. Decorative — trend is also stated in text. */
export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;
  const w = 100;
  const h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn('h-7 w-full', className)}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Fixed-height SVG bar chart (no chart lib, no layout shift). */
export function MiniBarChart({
  data,
  ariaLabel,
}: {
  data: { label: string; value: number }[];
  ariaLabel: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div role="img" aria-label={ariaLabel} className="flex h-40 items-end gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md bg-primary/85 transition-[height]"
              style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
            />
          </div>
          <span className="truncate text-[10px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

const TREND_TONE = {
  up: 'text-success',
  down: 'text-danger',
  neutral: 'text-muted-foreground',
} as const;

function InfoDot({ label }: { label: string }) {
  return (
    <Tooltip label={label}>
      <span
        className="inline-flex text-muted-foreground/70"
        tabIndex={0}
        role="img"
        aria-label={label}
      >
        <Info className="h-3.5 w-3.5" />
      </span>
    </Tooltip>
  );
}

/** KPI card. Renders as a link when a destination is set (keyboard accessible).
 *  Uses a full-height flex column so cards in the same grid row match height and
 *  the trend/footnote area pins to the bottom — no card looks unfinished. */
export function MetricCard({ metric, icon: Icon }: { metric: DashboardMetric; icon: LucideIcon }) {
  const cmp = metric.comparison;
  const hasSpark = !!metric.spark && metric.spark.length > 1;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">{metric.label}</span>
          {metric.helpText ? <InfoDot label={metric.helpText} /> : null}
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight">{metric.value}</span>
      </div>
      {cmp ? (
        <div className="mt-1 flex min-h-5 items-center gap-2">
          <span
            className={cn('flex items-center gap-1 text-xs font-medium', TREND_TONE[cmp.direction])}
          >
            {cmp.direction === 'up' ? (
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            ) : cmp.direction === 'down' ? (
              <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
            ) : null}
            {cmp.value > 0 ? '+' : ''}
            {cmp.value}% <span className="font-normal text-muted-foreground">{cmp.label}</span>
          </span>
        </div>
      ) : null}
      {/* Bottom area: sparkline when trend data exists, else a short footnote. */}
      <div className="mt-auto pt-3">
        {hasSpark ? (
          <div className={cn(cmp ? TREND_TONE[cmp.direction] : 'text-primary')}>
            <Sparkline data={metric.spark!} />
          </div>
        ) : metric.footnote ? (
          <p className="text-xs text-muted-foreground">{metric.footnote}</p>
        ) : null}
      </div>
    </>
  );

  const base =
    'flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1';
  return metric.destination ? (
    <Link
      href={metric.destination}
      className={cn(base, 'hover:border-primary')}
      aria-label={metric.label}
    >
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

export interface MetricSpec {
  metric: DashboardMetric;
  icon: LucideIcon;
}

/**
 * Container-aware KPI grid. Responds to the dashboard content width (not the
 * viewport) via CSS container queries, so it re-balances when the sidebar
 * collapses/expands at the same viewport. Optimised for the 5-card case:
 *
 *   ≥1400px content → 5 across
 *   1050–1399px     → balanced 3 + 2 (six-column internal grid)
 *   640–1049px      → 2 across, last odd card spans both (no orphan)
 *   <640px          → 1 across
 *
 * Any other count degrades to a clean 1 / 2 / 4 grid with no orphan card.
 */
export function KPIGrid({ metrics }: { metrics: MetricSpec[] }) {
  const isFive = metrics.length === 5;
  return (
    <div className="@container">
      <div
        className={cn(
          'grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2',
          isFive
            ? '@min-[1050px]:grid-cols-6 @min-[1400px]:grid-cols-5'
            : '@min-[1100px]:grid-cols-4',
        )}
      >
        {metrics.map((m, i) => (
          <div key={m.metric.id} className={kpiCellClass(i, metrics.length)}>
            <MetricCard metric={m.metric} icon={m.icon} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Per-card column spans that keep every breakpoint balanced (no orphan card). */
function kpiCellClass(i: number, n: number): string {
  if (n === 5) {
    // First three cards fill the six-column row (2+2+2); last two split it (3+3).
    const medium =
      i < 3
        ? '@min-[1050px]:col-span-2 @min-[1400px]:col-span-1'
        : '@min-[1050px]:col-span-3 @min-[1400px]:col-span-1';
    // On the two-column tablet layout the 5th card sits alone on row 3 → span both.
    const tablet = i === 4 ? '@min-[640px]:col-span-2 @min-[1050px]:col-span-1' : '';
    return cn(medium, tablet);
  }
  // Even counts never orphan; an odd last card spans both columns on tablet.
  const lastOdd = n % 2 === 1 && i === n - 1;
  return lastOdd ? '@min-[640px]:col-span-2 @min-[1100px]:col-span-1' : '';
}

/** Section card with a heading and optional right-side action. */
export function SectionCard({
  title,
  badge,
  action,
  className,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-2xl border border-border bg-card shadow-sm',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {badge}
        </div>
        {action}
      </header>
      <div className="min-w-0 flex-1 p-4">{children}</div>
    </section>
  );
}

/** Ghost "View all →" link used in section headers. */
export function ViewAllLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      View all
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

const BAR_TONE: Record<string, string> = {
  cash: 'bg-success',
  card: 'bg-primary',
  bank: 'bg-warning',
  qr: 'bg-violet-500',
  credit: 'bg-slate-400',
  other: 'bg-slate-300',
  primary: 'bg-primary',
  neutral: 'bg-slate-400',
};

export function ProgressBar({ percent, tone = 'primary' }: { percent: number; tone?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn('h-full rounded-full', BAR_TONE[tone] ?? 'bg-primary')}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

const STATUS_VARIANT = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  muted: 'neutral',
} as const;

export function StatusPill({
  tone,
  children,
}: {
  tone: keyof typeof STATUS_VARIANT;
  children: React.ReactNode;
}) {
  return <Badge variant={STATUS_VARIANT[tone]}>{children}</Badge>;
}

// ── loading / empty / error states ───────────────────────────────────────────

export function KpiSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-7 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-7 w-full animate-pulse rounded bg-muted" />
        </div>
      ))}
    </>
  );
}

export function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 w-full animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <p className="text-sm text-danger">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
