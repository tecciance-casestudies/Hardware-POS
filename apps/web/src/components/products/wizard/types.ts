import type { ManagedProduct } from '@/lib/products-api';

/** Plain product fields (unchanged from the original form — reused verbatim). */
export interface FormState {
  name: string;
  sku: string;
  barcode: string;
  brand: string;
  categoryId: string;
  subcategoryId: string;
  unitType: string;
  unitPrice: string;
  costPrice: string;
  quantityOnHand: string;
  reorderLevel: string;
  description: string;
  imageAltText: string;
  trackInventory: boolean;
  taxable: boolean;
  requiresWarehousePickup: boolean;
  isActive: boolean;
}

export function initialFormState(p?: ManagedProduct): FormState {
  return {
    name: p?.name ?? '',
    sku: p?.sku ?? '',
    barcode: p?.barcode ?? '',
    brand: p?.brand ?? '',
    categoryId: p?.categoryId ?? '',
    subcategoryId: p?.subcategoryId ?? '',
    unitType: p?.unitType ?? '',
    unitPrice: p ? String(p.unitPrice) : '',
    costPrice: p?.costPrice != null ? String(p.costPrice) : '',
    quantityOnHand: p ? String(p.quantityOnHand) : '0',
    reorderLevel: p?.reorderLevel != null ? String(p.reorderLevel) : '',
    description: p?.description ?? '',
    imageAltText: p?.imageAltText ?? '',
    trackInventory: p?.trackInventory ?? true,
    taxable: p?.taxable ?? true,
    requiresWarehousePickup: p?.requiresWarehousePickup ?? false,
    isActive: p?.isActive ?? true,
  };
}

export const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s));

export type ProductType = 'simple' | 'variations';

export type StepKey = 'type' | 'basic' | 'category' | 'pricing' | 'variations' | 'review';

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
