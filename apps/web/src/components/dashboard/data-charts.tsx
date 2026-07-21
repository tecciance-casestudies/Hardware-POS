'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { dashboardChartTokens } from '@/lib/dashboard/chart-tokens';

// ── shared datum ─────────────────────────────────────────────────────────────

export interface Segment {
  key: string;
  label: string;
  /** Share of the whole, 0–1. */
  fraction: number;
  color: string;
}

// ── Doughnut ─────────────────────────────────────────────────────────────────

/** Small gap (in normalized pathLength units) between segments. */
const GAP = 1.4;
/** Below this length we drop rounded caps so tiny slices don't overflow the gap. */
const ROUND_CAP_MIN = 5;

/**
 * Accessible SVG doughnut. No chart library: a fixed 100×100 viewBox (stable
 * height, no layout shift) with `pathLength`-normalized stroke segments, rounded
 * caps, a ~70% cutout and a swap-to-hover centre. The centre and legend carry
 * the real numbers, so this stays `role="img"` with a text summary; the card
 * owns the data table. Animates once on mount unless reduced-motion is set.
 */
export function Doughnut({
  segments,
  activeKey,
  onActivate,
  onSelect,
  ariaLabel,
  center,
  className,
}: {
  segments: Segment[];
  activeKey?: string | null;
  onActivate?: (key: string | null) => void;
  onSelect?: (key: string) => void;
  ariaLabel: string;
  center: React.ReactNode;
  className?: string;
}) {
  const single = segments.length === 1;
  const onlySegment = segments[0];
  let cursor = 0;

  return (
    <div className={cn('relative mx-auto aspect-square w-full max-w-[220px]', className)}>
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full doughnut-enter"
        role="img"
        aria-label={ariaLabel}
      >
        {/* Rotate the ring so segments start at 12 o'clock. Uses an SVG-space
            transform (not the CSS `transform`) so it never fights the CSS
            mount animation on the <svg>. */}
        <g transform="rotate(-90 50 50)">
        {/* track */}
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke={dashboardChartTokens.track}
          strokeWidth="13"
        />
        {single && onlySegment ? (
          <circle
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke={onlySegment.color}
            strokeWidth="14"
          />
        ) : (
          segments.map((s) => {
            const len = Math.max(0, s.fraction * 100 - GAP);
            const dashoffset = -cursor;
            cursor += s.fraction * 100;
            const dimmed = activeKey != null && activeKey !== s.key;
            return (
              <circle
                key={s.key}
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke={s.color}
                strokeWidth={activeKey === s.key ? 16 : 14}
                pathLength={100}
                strokeDasharray={`${len} ${100 - len}`}
                strokeDashoffset={dashoffset}
                strokeLinecap={len > ROUND_CAP_MIN ? 'round' : 'butt'}
                className="cursor-pointer transition-[stroke-width,opacity] duration-200"
                style={{ opacity: dimmed ? 0.35 : 1 }}
                onMouseEnter={() => onActivate?.(s.key)}
                onMouseLeave={() => onActivate?.(null)}
                onClick={() => onSelect?.(s.key)}
              />
            );
          })
        )}
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {center}
      </div>
    </div>
  );
}

// ── Horizontal ranking bars ──────────────────────────────────────────────────

export interface RankBar {
  key: string;
  rank: number;
  label: string;
  /** Bar width relative to the leader, 0–1. */
  ratio: number;
  /** Right-aligned primary value, preformatted. */
  valueLabel: string;
  /** Contribution/percent, preformatted (e.g. "58.9%"). */
  metaLabel: string;
  color: string;
  href?: string;
}

/**
 * Sorted horizontal bar chart rendered as semantic HTML rows (not canvas) so
 * labels never squeeze, values are always readable and every row is a real
 * keyboard-focusable link. Hover/focus highlights the row with the Volt-Lime
 * accent. The parent supplies a text summary + data table for a11y parity.
 */
export function HorizontalBars({
  bars,
  onNavigate,
  activeKey,
  onActivate,
  className,
}: {
  bars: RankBar[];
  onNavigate?: (key: string) => void;
  activeKey?: string | null;
  onActivate?: (key: string | null) => void;
  className?: string;
}) {
  return (
    <ol className={cn('space-y-3', className)}>
      {bars.map((b) => {
        const active = activeKey === b.key;
        return (
          <li key={b.key}>
            <button
              type="button"
              onClick={() => onNavigate?.(b.key)}
              onMouseEnter={() => onActivate?.(b.key)}
              onMouseLeave={() => onActivate?.(null)}
              onFocus={() => onActivate?.(b.key)}
              onBlur={() => onActivate?.(null)}
              className="group block w-full rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${b.label}: ${b.valueLabel}, ${b.metaLabel}. Rank ${b.rank}.`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
                    style={{ backgroundColor: b.color }}
                    aria-hidden
                  >
                    {b.rank}
                  </span>
                  <span className="truncate font-medium">{b.label}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold">{b.valueLabel}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">{b.metaLabel}</span>
                </span>
              </div>
              <div
                className="h-2.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: dashboardChartTokens.track }}
              >
                <div
                  className="bar-grow h-full rounded-full transition-colors duration-200"
                  style={{
                    width: `${Math.max(2, b.ratio * 100)}%`,
                    backgroundColor: active ? dashboardChartTokens.highlight : b.color,
                  }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ── Data table (accessible chart alternative) ────────────────────────────────

/**
 * Visible, accessible data table used behind the chart/data toggle. Renders the
 * exact chart values — never hidden from sighted keyboard users, only from the
 * default visual view.
 */
export function ChartDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: { key: string; label: string; align?: 'left' | 'right' }[];
  rows: { key: string; cells: React.ReactNode[]; accent?: string }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn('pb-2 font-medium', c.align === 'right' && 'text-right')}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.key}>
              {r.cells.map((cell, i) => (
                <td
                  key={columns[i]?.key ?? i}
                  className={cn(
                    'py-2 tabular-nums',
                    columns[i]?.align === 'right' && 'text-right',
                  )}
                >
                  {i === 0 && r.accent ? (
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: r.accent }}
                        aria-hidden
                      />
                      {cell}
                    </span>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
