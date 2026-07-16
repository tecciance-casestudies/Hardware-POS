'use client';

import * as React from 'react';

import { VariationBuilder } from '@/components/products/variations/variation-builder';
import type { VariationStore } from '@/lib/variations/variation-store';

import { ToggleRow, StepHeader } from './fields';
import { PricingInventoryStep } from './pricing-inventory-step';
import type { FieldErrors, FormState, ProductType, SetField } from './types';

/**
 * Step 2 of the simplified flow — price & stock, plus an optional, progressively
 * revealed variation setup. Enabling "This product has different options" shows
 * the existing guided VariationBuilder inline (no separate wizard step), so
 * simple products stay short while variation power remains one toggle away.
 */
export function PriceStockStep({
  form,
  set,
  errors,
  productType,
  stockLocked,
  computedVariantStock,
  variations,
  baseSku,
  basePrice,
}: {
  form: FormState;
  set: SetField;
  errors: FieldErrors;
  productType: ProductType;
  stockLocked: boolean;
  computedVariantStock: number | null;
  variations: VariationStore;
  baseSku: string;
  basePrice: number;
}) {
  const enabled = variations.data.enabled;

  return (
    <div className="space-y-6">
      <StepHeader
        eyebrow="Step 2 of 3"
        title="Price and stock"
        description="Enter the selling price and the quantity currently available."
      />

      <PricingInventoryStep
        form={form}
        set={set}
        errors={errors}
        productType={productType}
        stockLocked={stockLocked}
        computedVariantStock={computedVariantStock}
        embedded
      />

      {/* Optional variation setup — progressive disclosure. */}
      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <ToggleRow
          label="This product has different options"
          hint="Enable this when the product is sold in different colors, sizes, finishes, materials, or pack sizes."
          checked={enabled}
          onChange={(v) => variations.setEnabled(v)}
        />

        {enabled ? (
          <div className="space-y-2">
            <div>
              <h3 className="text-sm font-semibold">Product options</h3>
              <p className="text-xs text-muted-foreground">
                Add options, create combinations, then set price and stock. Everything saves with
                the product.
              </p>
            </div>
            <VariationBuilder store={variations} baseSku={baseSku} basePrice={basePrice} embedded />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Off — this product uses one SKU, one price, and one stock quantity.
          </p>
        )}
      </div>
    </div>
  );
}
