'use client';

import { X } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Variant } from '@/lib/variations/types';

/** Format a number as LKR, e.g. `Rs. 1,000.00`. Never shows USD. */
export function formatLkr(value: number): string {
  return `Rs. ${value.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** The effective selling price of a variant given base price + price mode. */
export function effectivePrice(variant: Variant, basePrice: number): number {
  return variant.price ?? basePrice;
}

export type StockState = 'in' | 'low' | 'out' | 'inactive';

export function stockStateOf(variant: Variant): StockState {
  if (!variant.active) return 'inactive';
  if (variant.stock <= 0) return 'out';
  if (variant.reorderLevel != null && variant.stock <= variant.reorderLevel) return 'low';
  return 'in';
}

export function StockBadge({ variant }: { variant: Variant }) {
  const state = stockStateOf(variant);
  const map: Record<StockState, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
    in: { label: 'In stock', variant: 'success' },
    low: { label: 'Low stock', variant: 'warning' },
    out: { label: 'Out of stock', variant: 'danger' },
    inactive: { label: 'Inactive', variant: 'neutral' },
  };
  const { label, variant: v } = map[state];
  // Dot + text so colour is never the only signal.
  return (
    <Badge variant={v}>
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          v === 'success' && 'bg-success',
          v === 'warning' && 'bg-warning',
          v === 'danger' && 'bg-danger',
          v === 'neutral' && 'bg-muted-foreground',
        )}
      />
      {label}
    </Badge>
  );
}

/** Small removable/plain chip used for option values and variant option tags. */
export function Chip({
  children,
  onRemove,
  removeLabel,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
  tone?: 'neutral' | 'brand';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium',
        tone === 'brand' ? 'bg-brand-50 text-brand-700' : 'bg-muted text-foreground',
      )}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? 'Remove'}
          className="grid h-4 w-4 place-items-center rounded text-muted-foreground hover:bg-border hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}

/** Horizontal 3-step indicator: Attributes → Combinations → Price & stock. */
export function StepIndicator({
  current,
  onStep,
  reached,
}: {
  current: 1 | 2 | 3;
  onStep: (step: 1 | 2 | 3) => void;
  /** Highest step the user is allowed to jump to. */
  reached: 1 | 2 | 3;
}) {
  const steps: { n: 1 | 2 | 3; label: string }[] = [
    { n: 1, label: 'Options' },
    { n: 2, label: 'Combinations' },
    { n: 3, label: 'Price & stock' },
  ];
  return (
    <ol className="flex items-center gap-2" aria-label="Variation builder steps">
      {steps.map((s, i) => {
        const active = s.n === current;
        const done = s.n < current;
        const enabled = s.n <= reached;
        return (
          <React.Fragment key={s.n}>
            <li>
              <button
                type="button"
                disabled={!enabled}
                onClick={() => onStep(s.n)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors',
                  active && 'bg-brand-50 text-brand-700',
                  !active && enabled && 'text-foreground hover:bg-muted',
                  !enabled && 'cursor-not-allowed text-muted-foreground/60',
                )}
              >
                <span
                  className={cn(
                    'grid h-6 w-6 place-items-center rounded-full text-xs font-semibold',
                    active && 'bg-primary text-primary-foreground',
                    done && 'bg-success text-white',
                    !active && !done && 'bg-muted text-muted-foreground',
                  )}
                >
                  {done ? '✓' : s.n}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </li>
            {i < steps.length - 1 ? (
              <li aria-hidden className="h-px w-4 bg-border sm:w-8" />
            ) : null}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

/** A labelled stat pill used in the overview + matrix summary rows. */
export function StatPill({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'neutral' | 'brand' | 'warning' | 'danger' | 'success';
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2',
        tone === 'brand' && 'border-brand-100 bg-brand-50',
        tone === 'warning' && 'border-warning-soft bg-warning-soft',
        tone === 'danger' && 'border-danger-soft bg-danger-soft',
        tone === 'success' && 'border-success-soft bg-success-soft',
        tone === 'neutral' && 'border-border bg-surface',
      )}
    >
      <div className="text-lg font-semibold leading-none">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/**
 * Right-side slide-over drawer (bulk edit + variant detail). Closes on Escape /
 * overlay click. Full-width on phones, fixed width on larger screens.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-full w-full max-w-md flex-col bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-border p-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
