'use client';

import { Boxes, ChevronDown, Package } from 'lucide-react';
import * as React from 'react';

import { ProductImage } from '@/components/product-image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatLkr } from '@/components/products/variations/shared';
import type { FormState, ProductType } from './types';

export interface SummaryData {
  form: FormState;
  productType: ProductType;
  imageSrc: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  variantCount: number;
  completedSteps: number;
  totalSteps: number;
}

/**
 * Live product summary. On desktop it's a sticky right rail; on tablet/phone it's a
 * collapsible card shown above the current step.
 */
export function ProductWizardSummary({
  data,
  variant = 'rail',
}: {
  data: SummaryData;
  variant?: 'rail' | 'collapsible';
}) {
  const [open, setOpen] = React.useState(false);

  const body = <SummaryBody data={data} />;

  if (variant === 'collapsible') {
    return (
      <div className="rounded-2xl border border-border bg-surface shadow-sm lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 p-3"
        >
          <span className="flex min-w-0 items-center gap-3">
            <ProductImage src={data.imageSrc} alt={data.form.name || 'Product'} className="h-10 w-10 rounded-lg" />
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-semibold">
                {data.form.name || 'Untitled product'}
              </span>
              <span className="block text-xs text-muted-foreground">
                {data.completedSteps}/{data.totalSteps} steps complete
              </span>
            </span>
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
        </button>
        {open ? <div className="border-t border-border p-4">{body}</div> : null}
      </div>
    );
  }

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Product summary</h3>
        {body}
      </div>
    </aside>
  );
}

function SummaryBody({ data }: { data: SummaryData }) {
  const { form } = data;
  const price = Number(form.unitPrice);
  return (
    <div className="space-y-4">
      <ProductImage src={data.imageSrc} alt={form.name || 'Product'} className="aspect-square w-full rounded-xl" />
      <div>
        <div className="text-base font-semibold">{form.name || 'Untitled product'}</div>
        <div className="mt-1 inline-flex items-center gap-1.5">
          {data.productType === 'variations' ? (
            <Badge variant="primary">
              <Boxes className="h-3 w-3" /> With variations
            </Badge>
          ) : (
            <Badge variant="neutral">
              <Package className="h-3 w-3" /> Simple product
            </Badge>
          )}
        </div>
      </div>

      <dl className="space-y-2 text-sm">
        <Row label="SKU" value={form.sku || '—'} />
        <Row label="Category" value={data.categoryName ?? 'Uncategorized'} />
        {data.subcategoryName ? <Row label="Subcategory" value={data.subcategoryName} /> : null}
        <Row label={data.productType === 'variations' ? 'Base price' : 'Selling price'} value={form.unitPrice ? formatLkr(price) : '—'} />
        {data.productType === 'variations' ? (
          <Row label="Combinations" value={String(data.variantCount)} />
        ) : null}
      </dl>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Completion</span>
          <span>
            {data.completedSteps}/{data.totalSteps}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.round((data.completedSteps / data.totalSteps) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] truncate font-medium">{value}</dd>
    </div>
  );
}
