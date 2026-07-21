'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/** True when the user asked the OS to minimise motion. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Count-up from 0 → value on mount / when value changes. Jumps under
 *  reduced-motion. Pure easing math keeps it unit-testable via `easeOutCubic`. */
export function AnimatedNumber({
  value,
  format,
  className,
  durationMs = 700,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  durationMs?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = React.useState(value);
  const fromRef = React.useRef(0);

  React.useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    const to = value;
    let raf = 0;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / durationMs);
      setDisplay(from + (to - from) * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced, durationMs]);

  return (
    <span className={cn('tabular-nums', className)}>{format(reduced ? value : display)}</span>
  );
}

export interface ChartPoint {
  label: string;
  value: number;
}

/** Build an SVG path `d` for a smooth-ish polyline through scaled points. */
function linePath(points: ChartPoint[], w: number, h: number, max: number): string {
  if (points.length === 0) return '';
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  return points
    .map((p, i) => {
      const x = i * step;
      const y = h - (p.value / max) * (h - 6) - 3;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

/**
 * Accessible area chart. No chart library: a fixed-viewBox SVG (stable height,
 * no layout shift) with a gradient fill, hover/tap tooltip + guide line, an
 * optional dashed comparison series, a `role="img"` summary and a
 * visually-hidden data table for screen readers.
 */
export function AreaChart({
  points,
  comparison,
  ariaSummary,
  valueFormat,
  onSelect,
  className,
}: {
  points: ChartPoint[];
  comparison?: ChartPoint[] | null;
  ariaSummary: string;
  valueFormat: (n: number) => string;
  onSelect?: (index: number) => void;
  className?: string;
}) {
  const W = 600;
  const H = 180;
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [hover, setHover] = React.useState<number | null>(null);

  const max = Math.max(1, ...points.map((p) => p.value), ...(comparison ?? []).map((p) => p.value));
  const step = points.length > 1 ? W / (points.length - 1) : 0;

  const line = linePath(points, W, H, max);
  const area = line
    ? `${line} L${(points.length - 1) * step},${H} L0,${H} Z`
    : '';

  const locate = (clientX: number) => {
    const el = svgRef.current;
    if (!el || points.length === 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const idx = Math.round(ratio * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, idx)));
  };

  const active = hover ?? null;
  const activePoint = active !== null ? points[active] : undefined;
  const activeX = active !== null ? active * step : 0;
  const activeY = activePoint ? H - (activePoint.value / max) * (H - 6) - 3 : 0;

  return (
    <div className={cn('min-w-0', className)}>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-44 w-full touch-none"
          role="img"
          aria-label={ariaSummary}
          onMouseMove={(e) => locate(e.clientX)}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) locate(t.clientX);
          }}
          onTouchMove={(e) => {
            const t = e.touches[0];
            if (t) locate(t.clientX);
          }}
          onTouchEnd={() => setHover(null)}
        >
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* light baseline gridlines */}
          {[0.25, 0.5, 0.75].map((g) => (
            <line
              key={g}
              x1="0"
              x2={W}
              y1={H * g}
              y2={H * g}
              stroke="var(--color-border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {comparison && comparison.length > 1 ? (
            <path
              d={linePath(comparison, W, H, max)}
              fill="none"
              stroke="var(--color-muted-foreground)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
              opacity="0.6"
            />
          ) : null}

          {area ? <path d={area} fill="url(#areaFill)" /> : null}
          {line ? (
            <path
              d={line}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className="transition-[d] duration-500"
            />
          ) : null}

          {active !== null ? (
            <>
              <line
                x1={activeX}
                x2={activeX}
                y1="0"
                y2={H}
                stroke="var(--color-primary)"
                strokeWidth="1"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
                opacity="0.5"
              />
              <circle cx={activeX} cy={activeY} r="4" fill="var(--color-primary)" />
              <circle cx={activeX} cy={activeY} r="7" fill="var(--color-primary)" opacity="0.2" />
            </>
          ) : null}
        </svg>

        {/* Tooltip — positioned in % so it tracks the responsive SVG width. */}
        {activePoint ? (
          <div
            className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-center shadow-pop"
            style={{ left: `${(activeX / W) * 100}%` }}
          >
            <div className="text-[11px] text-muted-foreground">{activePoint.label}</div>
            <div className="text-sm font-semibold tabular-nums">
              {valueFormat(activePoint.value)}
            </div>
          </div>
        ) : null}
      </div>

      {/* Clickable x-axis labels — keyboard-accessible drill-down. */}
      <div className="mt-2 flex justify-between gap-1">
        {points.map((p, i) => (
          <button
            key={`${p.label}-${i}`}
            type="button"
            onClick={() => onSelect?.(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            className={cn(
              'min-w-0 flex-1 truncate rounded px-0.5 text-[10px] transition-colors',
              onSelect ? 'hover:text-primary focus-visible:text-primary' : 'cursor-default',
              active === i ? 'font-semibold text-primary' : 'text-muted-foreground',
            )}
            tabIndex={onSelect ? 0 : -1}
            aria-label={onSelect ? `${p.label}: ${valueFormat(p.value)} — open sales` : undefined}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Screen-reader data table. */}
      <table className="sr-only">
        <caption>{ariaSummary}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={`${p.label}-row-${i}`}>
              <th scope="row">{p.label}</th>
              <td>{valueFormat(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tiny decorative sparkline (trend is always also stated in text). */
export function Sparkline({
  data,
  className,
}: {
  data: number[];
  className?: string;
}) {
  if (data.length < 2) return null;
  const w = 100;
  const h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
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
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
