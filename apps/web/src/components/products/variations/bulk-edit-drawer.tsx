'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { Variant } from '@/lib/variations/types';
import type { VariationStore } from '@/lib/variations/variation-store';
import { suggestSku } from '@/lib/variations/variation-combination-utils';

import { Drawer } from './shared';

type BulkField =
  | 'sellingPriceBase'
  | 'sellingPriceCustom'
  | 'costPrice'
  | 'stockSet'
  | 'stockIncrease'
  | 'stockDecrease'
  | 'reorderLevel'
  | 'activate'
  | 'deactivate'
  | 'generateSku';

const NUMERIC_FIELDS: BulkField[] = [
  'sellingPriceCustom',
  'costPrice',
  'stockSet',
  'stockIncrease',
  'stockDecrease',
  'reorderLevel',
];

export function BulkEditDrawer({
  open,
  onClose,
  store,
  baseSku,
  selectedKeys,
  onClearSelection,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  store: VariationStore;
  baseSku: string;
  selectedKeys: string[];
  onClearSelection: () => void;
  onApplied: (msg: string) => void;
}) {
  const [field, setField] = React.useState<BulkField>('stockSet');
  const [value, setValue] = React.useState('');
  const count = selectedKeys.length;
  const needsValue = NUMERIC_FIELDS.includes(field);

  const apply = () => {
    const num = Number(value);
    const patch = (v: Variant): Partial<Variant> => {
      switch (field) {
        case 'sellingPriceBase':
          return { price: null };
        case 'sellingPriceCustom':
          return { price: Number.isFinite(num) ? num : v.price };
        case 'costPrice':
          return { cost: value.trim() === '' ? null : num };
        case 'stockSet':
          return { stock: Number.isFinite(num) ? num : v.stock };
        case 'stockIncrease':
          return { stock: Math.max(0, v.stock + (Number.isFinite(num) ? num : 0)) };
        case 'stockDecrease':
          return { stock: Math.max(0, v.stock - (Number.isFinite(num) ? num : 0)) };
        case 'reorderLevel':
          return { reorderLevel: value.trim() === '' ? null : num };
        case 'activate':
          return { active: true };
        case 'deactivate':
          return { active: false };
        case 'generateSku':
          return { sku: suggestSku(baseSku, store.data.attributes, v.selections) };
        default:
          return {};
      }
    };
    store.bulkUpdate(selectedKeys, patch);
    onApplied(`Updated ${count} variant${count === 1 ? '' : 's'}`);
    setValue('');
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Bulk edit"
      description={`${count} variant${count === 1 ? '' : 's'} selected`}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              onClearSelection();
              onClose();
            }}
          >
            Clear selection
          </Button>
          <Button onClick={apply} disabled={count === 0 || (needsValue && value.trim() === '')}>
            Apply
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-1.5">
          <Label htmlFor="bulk-field">Field to update</Label>
          <Select id="bulk-field" value={field} onChange={(e) => setField(e.target.value as BulkField)}>
            <optgroup label="Price">
              <option value="sellingPriceBase">Use base price</option>
              <option value="sellingPriceCustom">Set custom selling price</option>
              <option value="costPrice">Set cost price</option>
            </optgroup>
            <optgroup label="Stock">
              <option value="stockSet">Set stock</option>
              <option value="stockIncrease">Increase stock by</option>
              <option value="stockDecrease">Decrease stock by</option>
              <option value="reorderLevel">Set reorder level</option>
            </optgroup>
            <optgroup label="Status">
              <option value="activate">Activate</option>
              <option value="deactivate">Deactivate</option>
            </optgroup>
            <optgroup label="Codes">
              <option value="generateSku">Generate SKU</option>
            </optgroup>
          </Select>
        </div>

        {needsValue ? (
          <div className="grid gap-1.5">
            <Label htmlFor="bulk-value">
              {field === 'costPrice' || field.startsWith('sellingPrice') ? 'Value (Rs.)' : 'Value'}
            </Label>
            <Input
              id="bulk-value"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={field === 'reorderLevel' || field === 'costPrice' ? 'Leave blank to clear' : '0'}
              autoFocus
            />
          </div>
        ) : (
          <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
            This action applies immediately to all selected variants when you press Apply.
          </p>
        )}
      </div>
    </Drawer>
  );
}
