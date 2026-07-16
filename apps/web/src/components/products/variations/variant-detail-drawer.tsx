'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { PriceMode, Variant, VariationAttribute } from '@/lib/variations/types';
import { variantChips, variantLabel } from '@/lib/variations/variation-combination-utils';

import { Chip, Drawer, formatLkr } from './shared';

/** Detailed single-variant editor. Local draft; commits on Save. */
export function VariantDetailDrawer({
  open,
  onClose,
  variant,
  attributes,
  basePrice,
  priceMode,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  variant: Variant | null;
  attributes: VariationAttribute[];
  basePrice: number;
  priceMode: PriceMode;
  onSave: (key: string, patch: Partial<Variant>) => void;
}) {
  const [draft, setDraft] = React.useState<Variant | null>(variant);

  React.useEffect(() => setDraft(variant), [variant]);

  if (!open || !draft) return null;

  const set = <K extends keyof Variant>(key: K, val: Variant[K]) =>
    setDraft((d) => (d ? { ...d, [key]: val } : d));

  const usesBase = draft.price == null;
  const priceLocked = priceMode === 'single';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Edit variant"
      description={variantLabel(attributes, draft.selections)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(draft.key, draft);
              onClose();
            }}
          >
            Save variant
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-1.5">
          {variantChips(attributes, draft.selections).map((c) => (
            <Chip key={c.attribute} tone="brand">
              <span className="text-brand-700/70">{c.attribute}:</span> {c.value}
            </Chip>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU">
            <Input value={draft.sku} onChange={(e) => set('sku', e.target.value)} placeholder="e.g. SKU-RED-M" />
          </Field>
          <Field label="Barcode">
            <Input value={draft.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="Optional" />
          </Field>
        </div>

        <Field label="Selling price">
          {priceLocked ? (
            <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
              Uses base price — {formatLkr(basePrice)} (Price strategy is “One price for all”).
            </p>
          ) : (
            <div className="space-y-2">
              <Select
                value={usesBase ? 'base' : 'custom'}
                onChange={(e) => set('price', e.target.value === 'base' ? null : (draft.price ?? basePrice))}
              >
                <option value="base">Use base price — {formatLkr(basePrice)}</option>
                <option value="custom">Custom price</option>
              </Select>
              {!usesBase ? (
                <Input
                  inputMode="decimal"
                  value={draft.price ?? ''}
                  onChange={(e) => set('price', e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="0.00"
                />
              ) : null}
            </div>
          )}
        </Field>

        <Field label="Cost price" hint="Optional">
          <Input
            inputMode="decimal"
            value={draft.cost ?? ''}
            onChange={(e) => set('cost', e.target.value === '' ? null : Number(e.target.value))}
            placeholder="Optional"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Stock">
            <Input
              inputMode="numeric"
              value={draft.stock}
              onChange={(e) => set('stock', Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Reorder level">
            <Input
              inputMode="numeric"
              value={draft.reorderLevel ?? ''}
              onChange={(e) => set('reorderLevel', e.target.value === '' ? null : Number(e.target.value))}
              placeholder="Optional"
            />
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border p-3">
          <div>
            <div className="text-sm font-medium">Active</div>
            <div className="text-xs text-muted-foreground">Inactive variants are hidden from the POS.</div>
          </div>
          <Switch checked={draft.active} onCheckedChange={(v) => set('active', v)} />
        </div>

        <Field label="Internal note" hint="Not shown to customers">
          <Textarea
            rows={2}
            value={draft.note}
            onChange={(e) => set('note', e.target.value)}
            placeholder="Optional note for staff"
          />
        </Field>

        {/* TODO(backend): surface real QuickBooks mapping status once variants sync. */}
        <div className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
          QuickBooks mapping: <span className="font-medium text-foreground">Not linked</span> (variant sync
          is not available yet).
        </div>
      </div>
    </Drawer>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
