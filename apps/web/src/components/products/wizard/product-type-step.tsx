'use client';

import { Boxes, Check, Package } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';
import { StepHeader } from './fields';
import type { ProductType } from './types';

export function ProductTypeStep({
  value,
  onChange,
}: {
  value: ProductType;
  onChange: (t: ProductType) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        eyebrow="Step 1"
        title="What type of product are you adding?"
        description="This decides what information we'll ask for next. You can change it later."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <TypeCard
          active={value === 'simple'}
          onSelect={() => onChange('simple')}
          icon={<Package className="h-6 w-6" />}
          title="Simple product"
          subtitle="One SKU, one price, and one stock quantity."
          example={['Angle Grinder 4 inch', 'One item code', 'One selling price', 'One stock value']}
        />
        <TypeCard
          active={value === 'variations'}
          onSelect={() => onChange('variations')}
          icon={<Boxes className="h-6 w-6" />}
          title="Product with variations"
          subtitle="Multiple options such as color, size, finish, material or pack size."
          example={['Carrara Blanc Wall Tile', 'Multiple colors', 'Multiple sizes', 'Different stock per combination']}
        />
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        {value === 'variations' ? (
          <>
            <strong className="text-foreground">Next:</strong> basic details, category &amp; image, a base
            price, then a guided setup to add options and generate combinations.
          </>
        ) : (
          <>
            <strong className="text-foreground">Next:</strong> basic details, category &amp; image, then
            price &amp; inventory. Quick and simple.
          </>
        )}
      </div>
    </div>
  );
}

function TypeCard({
  active,
  onSelect,
  icon,
  title,
  subtitle,
  example,
}: {
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  example: string[];
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'flex flex-col gap-3 rounded-2xl border p-5 text-left transition-colors',
        active ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-border bg-surface hover:bg-muted',
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'grid h-12 w-12 place-items-center rounded-xl',
            active ? 'bg-brand-600 text-white' : 'bg-muted text-muted-foreground',
          )}
        >
          {icon}
        </span>
        {active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-medium text-white">
            <Check className="h-3 w-3" /> Selected
          </span>
        ) : null}
      </div>
      <div>
        <div className="text-base font-semibold">{title}</div>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <ul className="mt-1 space-y-1 rounded-xl bg-surface/70 p-3 text-xs text-muted-foreground">
        <li className="font-medium text-foreground">{example[0]}</li>
        {example.slice(1).map((line) => (
          <li key={line}>• {line}</li>
        ))}
      </ul>
    </button>
  );
}
