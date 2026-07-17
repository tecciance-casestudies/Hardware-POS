'use client';

import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import * as React from 'react';

import { formatMoney } from '@/lib/utils';
import { StepHeader } from './fields';
import type { FormState, StepKey } from './types';

export interface ReviewIssue {
  label: string;
  step: StepKey;
}

const TYPE_LABEL: Record<FormState['type'], string> = {
  Inventory: 'Inventory',
  NonInventory: 'Non-Inventory',
  Service: 'Service',
};

export function ReviewStep({
  form,
  categoryName,
  subcategoryName,
  completed,
  issues,
  onGoTo,
  stepLabel,
}: {
  form: FormState;
  categoryName: string | null;
  subcategoryName: string | null;
  completed: string[];
  issues: ReviewIssue[];
  onGoTo: (step: StepKey) => void;
  stepLabel: string;
}) {
  const isInventory = form.type === 'Inventory';

  return (
    <div className="space-y-5">
      <StepHeader
        eyebrow={stepLabel}
        title="Review & save"
        description="Check everything looks right. You can jump back to any step to make changes."
      />

      {/* Validation cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-success-soft bg-success-soft/60 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" /> Ready
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-success/90">
            {completed.length ? (
              completed.map((c) => <li key={c}>• {c}</li>)
            ) : (
              <li className="text-muted-foreground">Nothing confirmed yet.</li>
            )}
          </ul>
        </div>
        <div
          className={
            issues.length
              ? 'rounded-2xl border border-warning-soft bg-warning-soft/60 p-4'
              : 'rounded-2xl border border-border bg-surface p-4'
          }
        >
          <h3 className="flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertTriangle className="h-4 w-4" /> Needs attention
          </h3>
          {issues.length ? (
            <ul className="mt-2 space-y-1">
              {issues.map((it, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onGoTo(it.step)}
                    className="inline-flex items-center gap-1 text-sm text-warning hover:underline"
                  >
                    {it.label}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No issues found. You’re good to go.
            </p>
          )}
        </div>
      </div>

      {/* Summary — mirrors the QuickBooks Products & Services columns */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard title="Details" onEdit={() => onGoTo('details')}>
          <Row label="Name" value={form.name || '—'} />
          <Row label="Item type" value={TYPE_LABEL[form.type]} />
          <Row label="SKU" value={form.sku || '—'} />
          <Row label="Category" value={categoryName ?? 'Uncategorized'} />
          <Row label="Subcategory" value={subcategoryName ?? '—'} />
          <Row label="Sales description" value={form.description || '—'} />
        </SummaryCard>

        <SummaryCard title="Pricing" onEdit={() => onGoTo('pricing')}>
          <Row
            label="Sales price/rate"
            value={form.unitPrice ? formatMoney(Number(form.unitPrice)) : '—'}
          />
          <Row
            label="Purchase cost"
            value={form.costPrice ? formatMoney(Number(form.costPrice)) : '—'}
          />
          <Row label="Purchase description" value={form.purchaseDescription || '—'} />
        </SummaryCard>

        <SummaryCard title="Inventory" onEdit={() => onGoTo('pricing')} className="sm:col-span-2">
          {isInventory ? (
            <>
              <Row label="Quantity on hand" value={form.quantityOnHand || '0'} />
              <Row label="Quantity as of date" value={form.quantityAsOfDate || '—'} />
              <Row label="Reorder point" value={form.reorderLevel || '—'} />
            </>
          ) : (
            <Row label="Stock tracking" value={`Not applicable for ${TYPE_LABEL[form.type]}`} />
          )}
          <Row label="Status" value={form.isActive ? 'Active' : 'Inactive'} />
        </SummaryCard>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  onEdit,
  className,
  children,
}: {
  title: string;
  onEdit: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-4 ${className ?? ''}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button type="button" onClick={onEdit} className="text-xs text-primary hover:underline">
          Edit
        </button>
      </div>
      <dl className="space-y-1.5 text-sm">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] truncate text-right font-medium">{value}</dd>
    </div>
  );
}
