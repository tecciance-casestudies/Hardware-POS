'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { Field, InfoPanel, StepHeader, ToggleRow } from './fields';
import type { FieldErrors, FormState, ProductType, SetField } from './types';

export function PricingInventoryStep({
  form,
  set,
  errors,
  productType,
  stockLocked,
  computedVariantStock,
  stepLabel,
}: {
  form: FormState;
  set: SetField;
  errors: FieldErrors;
  productType: ProductType;
  /** QuickBooks-managed stock the user may not edit. */
  stockLocked: boolean;
  /** For variation products, the read-only sum of all variant stock. */
  computedVariantStock: number | null;
  stepLabel: string;
}) {
  const isVariation = productType === 'variations';

  return (
    <div className="space-y-5">
      <StepHeader
        eyebrow={stepLabel}
        title={isVariation ? 'Base price & inventory rules' : 'Price & inventory'}
        description={
          isVariation
            ? 'Set the base price used for every combination, and how stock is tracked. You’ll enter stock per combination in the next step.'
            : 'Set the selling price, cost and stock for this product.'
        }
      />

      {/* Pricing */}
      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold">{isVariation ? 'Base pricing' : 'Pricing'}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={isVariation ? 'Base selling price (Rs.)' : 'Selling price (Rs.)'}
            htmlFor="field-price"
            required
            error={errors.unitPrice}
            help={isVariation ? 'The base price is automatically used for every combination unless you change it.' : undefined}
          >
            <Input
              id="field-price"
              inputMode="decimal"
              value={form.unitPrice}
              onChange={(e) => set('unitPrice', e.target.value)}
              placeholder="0.00"
              aria-invalid={!!errors.unitPrice || undefined}
            />
          </Field>
          <Field label={isVariation ? 'Base cost price (Rs.)' : 'Cost price (Rs.)'} htmlFor="field-cost" hint="Optional">
            <Input
              id="field-cost"
              inputMode="decimal"
              value={form.costPrice}
              onChange={(e) => set('costPrice', e.target.value)}
              placeholder="Optional"
            />
          </Field>
        </div>
        <ToggleRow
          label="Taxable"
          hint="Apply tax/VAT to this product."
          checked={form.taxable}
          onChange={(v) => set('taxable', v)}
        />
      </div>

      {/* Inventory */}
      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <h3 className="text-sm font-semibold">{isVariation ? 'Inventory rules' : 'Inventory'}</h3>

        <ToggleRow
          label={isVariation ? 'Track stock separately for each combination' : 'Track inventory'}
          hint={isVariation ? 'Stock is entered per color, size, or other combination.' : 'Deduct stock as this product is sold.'}
          checked={form.trackInventory}
          onChange={(v) => set('trackInventory', v)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          {isVariation ? (
            <Field label="Total stock (all combinations)" htmlFor="field-qty" hint="Calculated">
              <Input id="field-qty" value={computedVariantStock ?? 0} disabled readOnly />
            </Field>
          ) : (
            <Field
              label="Quantity on hand"
              htmlFor="field-qty"
              hint={stockLocked ? 'Managed by QuickBooks' : undefined}
            >
              <Input
                id="field-qty"
                inputMode="decimal"
                value={form.quantityOnHand}
                onChange={(e) => set('quantityOnHand', e.target.value)}
                disabled={stockLocked}
              />
            </Field>
          )}
          <Field
            label={isVariation ? 'Default low-stock alert' : 'Reorder level'}
            htmlFor="field-reorder"
            help="You’ll get a low-stock warning when stock reaches this number."
          >
            <Input
              id="field-reorder"
              inputMode="decimal"
              value={form.reorderLevel}
              onChange={(e) => set('reorderLevel', e.target.value)}
              placeholder="Optional"
            />
          </Field>
        </div>

        <ToggleRow
          label="Requires warehouse pickup"
          hint="Bulky/heavy items picked from the warehouse."
          checked={form.requiresWarehousePickup}
          onChange={(v) => set('requiresWarehousePickup', v)}
        />
        <ToggleRow
          label="Active"
          hint="Inactive products are hidden from the POS."
          checked={form.isActive}
          onChange={(v) => set('isActive', v)}
        />
      </div>

      {isVariation ? (
        <InfoPanel>
          The base price will be used for every variation unless you set a different price. Stock will be
          entered separately for each color, size, or other combination.
        </InfoPanel>
      ) : null}
    </div>
  );
}
