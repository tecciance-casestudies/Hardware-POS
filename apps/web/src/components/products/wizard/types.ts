import type { ManagedProduct, ProductItemType } from '@/lib/products-api';

/**
 * Product form fields — mirrors the QuickBooks Products & Services template:
 * name, category, item type, SKU, sales description/price, purchase
 * description/cost, quantity on hand + as-of date, and reorder point. The
 * three QBO account names are auto-resolved server-side (read-only here).
 */
export interface FormState {
  name: string;
  type: ProductItemType;
  sku: string;
  categoryId: string;
  subcategoryId: string;
  /** Sales description. */
  description: string;
  /** Sales price/rate. */
  unitPrice: string;
  /** Purchase description. */
  purchaseDescription: string;
  /** Purchase cost. */
  costPrice: string;
  quantityOnHand: string;
  /** Quantity as of date (YYYY-MM-DD). */
  quantityAsOfDate: string;
  /** Reorder point. */
  reorderLevel: string;
  isActive: boolean;
}

const today = (): string => new Date().toISOString().slice(0, 10);

export function initialFormState(p?: ManagedProduct): FormState {
  return {
    name: p?.name ?? '',
    type: p?.type ?? 'Inventory',
    sku: p?.sku ?? '',
    categoryId: p?.categoryId ?? '',
    subcategoryId: p?.subcategoryId ?? '',
    description: p?.description ?? '',
    unitPrice: p ? String(p.unitPrice) : '',
    purchaseDescription: p?.purchaseDescription ?? '',
    costPrice: p?.costPrice != null ? String(p.costPrice) : '',
    quantityOnHand: p ? String(p.quantityOnHand) : '0',
    quantityAsOfDate: p?.quantityAsOfDate ? p.quantityAsOfDate.slice(0, 10) : today(),
    reorderLevel: p?.reorderLevel != null ? String(p.reorderLevel) : '',
    isActive: p?.isActive ?? true,
  };
}

export const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s));

export type StepKey = 'details' | 'pricing' | 'review';

export type StepStatus = 'todo' | 'current' | 'complete' | 'attention' | 'optional';

export interface StepMeta {
  key: StepKey;
  label: string;
  title: string;
  description: string;
}

/** Field-level errors for a step, keyed by FormState field name. */
export type FieldErrors = Partial<Record<keyof FormState, string>>;

/** Shared setter type passed to steps. */
export type SetField = <K extends keyof FormState>(key: K, value: FormState[K]) => void;
