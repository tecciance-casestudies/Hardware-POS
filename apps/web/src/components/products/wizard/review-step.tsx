'use client';

import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import * as React from 'react';

import { ProductImage } from '@/components/product-image';
import { formatLkr } from '@/components/products/variations/shared';
import { StepHeader } from './fields';
import type { FormState, ProductType, StepKey } from './types';

export interface ReviewIssue {
  label: string;
  step: StepKey;
}

export interface VariationSummary {
  attributes: number;
  combinations: number;
  priceModeLabel: string;
  totalStock: number;
  outOfStock: number;
  missingSku: number;
  needAttention: number;
}

export function ReviewStep({
  form,
  productType,
  categoryName,
  subcategoryName,
  imageSrc,
  variation,
  completed,
  issues,
  onGoTo,
  stepLabel,
}: {
  form: FormState;
  productType: ProductType;
  categoryName: string | null;
  subcategoryName: string | null;
  imageSrc: string | null;
  variation: VariationSummary | null;
  completed: string[];
  issues: ReviewIssue[];
  onGoTo: (step: StepKey) => void;
  stepLabel: string;
}) {
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
            <p className="mt-2 text-sm text-muted-foreground">No issues found. You’re good to go.</p>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
        <ProductImage src={imageSrc} alt={form.name || 'Product'} className="aspect-square w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          <SummaryCard title="Basic" onEdit={() => onGoTo('basic')}>
            <Row label="Name" value={form.name || '—'} />
            <Row label="SKU" value={form.sku || '—'} />
            <Row label="Brand" value={form.brand || '—'} />
            <Row label="Unit" value={form.unitType || '—'} />
          </SummaryCard>

          <SummaryCard title="Category" onEdit={() => onGoTo('category')}>
            <Row label="Category" value={categoryName ?? 'Uncategorized'} />
            <Row label="Subcategory" value={subcategoryName ?? '—'} />
          </SummaryCard>

          <SummaryCard title="Pricing" onEdit={() => onGoTo('pricing')}>
            <Row label={productType === 'variations' ? 'Base price' : 'Selling price'} value={form.unitPrice ? formatLkr(Number(form.unitPrice)) : '—'} />
            <Row label="Cost price" value={form.costPrice ? formatLkr(Number(form.costPrice)) : '—'} />
            <Row label="Tax" value={form.taxable ? 'Taxable' : 'Not taxable'} />
          </SummaryCard>

          <SummaryCard title="Inventory" onEdit={() => onGoTo('pricing')}>
            <Row label="Tracking" value={form.trackInventory ? 'On' : 'Off'} />
            <Row label="Warehouse pickup" value={form.requiresWarehousePickup ? 'Yes' : 'No'} />
            <Row label="Status" value={form.isActive ? 'Active' : 'Inactive'} />
          </SummaryCard>

          {variation ? (
            <SummaryCard title="Variations" onEdit={() => onGoTo('variations')} className="sm:col-span-2">
              <Row label="Options" value={String(variation.attributes)} />
              <Row label="Combinations" value={String(variation.combinations)} />
              <Row label="Price strategy" value={variation.priceModeLabel} />
              <Row label="Total stock" value={String(variation.totalStock)} />
              <Row label="Out of stock" value={String(variation.outOfStock)} />
              <Row label="Missing SKU" value={String(variation.missingSku)} />
            </SummaryCard>
          ) : null}
        </div>
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
