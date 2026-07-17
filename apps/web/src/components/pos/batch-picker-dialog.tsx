'use client';

import * as React from 'react';
import { Layers } from 'lucide-react';

import { Dialog } from '@/components/ui/dialog';
import { ProductImage } from '@/components/product-image';
import type { ClientProduct } from '@/lib/catalog';
import { cn, formatMoney } from '@/lib/utils';

/**
 * Manual batch selection for batch-tracked products (shared `baseSku`).
 * Tiles etc. vary in shade/caliber per production batch, so the keeper — not
 * the system — chooses which batch a sale draws from. Every in-stock batch is
 * listed, including near-empty ones (remnants are deliberately sellable).
 */
export function BatchPickerDialog({
  baseSku,
  members,
  currency,
  onPick,
  onClose,
}: {
  baseSku: string;
  /** All batches of the family currently in the catalog. */
  members: ClientProduct[];
  currency: string;
  onPick: (product: ClientProduct) => void;
  onClose: () => void;
}) {
  const inStock = members
    .filter((m) => m.quantityOnHand > 0)
    .sort((a, b) => (a.batchCode ?? '').localeCompare(b.batchCode ?? ''));

  return (
    <Dialog open onClose={onClose} className="max-w-md">
      <div className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Layers className="h-5 w-5 text-primary" />
            Choose a batch
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {members[0]?.name ?? baseSku} · code {baseSku}. Shade and caliber can differ between
            batches — keep one order within one batch.
          </p>
        </div>

        {inStock.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No batches of this product are in stock.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {inStock.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onPick(m)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-primary hover:bg-brand-50"
                >
                  <ProductImage src={m.imageUrl} alt={m.name} className="h-11 w-11 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
                        {m.batchCode ?? '—'}
                      </span>
                      <span
                        className={cn(
                          'text-xs',
                          m.quantityOnHand <= 5 ? 'font-medium text-warning' : 'text-muted-foreground',
                        )}
                      >
                        {m.quantityOnHand.toLocaleString()}
                        {m.unitType ? ` ${m.unitType}` : ''} left
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{m.name}</div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-primary">
                    {formatMoney(m.unitPrice, currency)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
