'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, InfoPanel, StepHeader } from './fields';
import type { FieldErrors, FormState, ProductType, SetField } from './types';

export function BasicInformationStep({
  form,
  set,
  errors,
  productType,
  stepLabel,
}: {
  form: FormState;
  set: SetField;
  errors: FieldErrors;
  productType: ProductType;
  stepLabel: string;
}) {
  return (
    <div className="space-y-5">
      <StepHeader
        eyebrow={stepLabel}
        title="Basic information"
        description="Enter the main information customers and staff will use to identify this product."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product name" htmlFor="field-name" required error={errors.name} className="sm:col-span-2">
          <Input
            id="field-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Carrara Blanc Wall Tile"
            aria-invalid={!!errors.name || undefined}
            aria-describedby={errors.name ? 'field-name-error' : undefined}
          />
        </Field>

        <Field
          label={productType === 'variations' ? 'Base SKU' : 'SKU'}
          htmlFor="field-sku"
          hint={productType === 'variations' ? undefined : 'Item code'}
          help={
            productType === 'variations'
              ? 'This will be used as the starting code for generated variation SKUs.'
              : 'The unique item code used at the register.'
          }
        >
          <Input
            id="field-sku"
            value={form.sku}
            onChange={(e) => set('sku', e.target.value)}
            placeholder={productType === 'variations' ? 'e.g. CBWT' : 'e.g. GRND-4'}
          />
        </Field>

        <Field label="Barcode" htmlFor="field-barcode" error={errors.barcode}>
          <Input
            id="field-barcode"
            value={form.barcode}
            onChange={(e) => set('barcode', e.target.value)}
            placeholder="e.g. 6001234599999"
            aria-invalid={!!errors.barcode || undefined}
          />
        </Field>

        <Field label="Brand" htmlFor="field-brand">
          <Input id="field-brand" value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="e.g. Lanka Tiles" />
        </Field>

        <Field label="Unit type" htmlFor="field-unit" help="How the item is sold — each piece, bag, metre, etc.">
          <Input id="field-unit" value={form.unitType} onChange={(e) => set('unitType', e.target.value)} placeholder="e.g. Piece" />
        </Field>

        <Field label="Description" htmlFor="field-description" className="sm:col-span-2">
          <Textarea
            id="field-description"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Optional description"
            rows={3}
          />
        </Field>
      </div>

      <InfoPanel>Customers and cashiers will see the product name and image in the POS.</InfoPanel>
    </div>
  );
}
