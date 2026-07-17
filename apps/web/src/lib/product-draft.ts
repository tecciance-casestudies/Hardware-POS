'use client';

/**
 * Product-wizard draft persistence (wizard progress only).
 *
 * Saves the in-progress wizard (form fields + current step) to localStorage so
 * a refresh or accidental navigation doesn't lose work. Components never touch
 * localStorage directly.
 */

const LS_PREFIX = 'hpos.productDraft.';

/** Mirrors the wizard FormState (QuickBooks Products & Services fields). */
export interface ProductDraftFields {
  name: string;
  type: 'Inventory' | 'NonInventory' | 'Service';
  sku: string;
  categoryId: string;
  subcategoryId: string;
  description: string;
  unitPrice: string;
  purchaseDescription: string;
  costPrice: string;
  quantityOnHand: string;
  quantityAsOfDate: string;
  reorderLevel: string;
  isActive: boolean;
}

export interface ProductDraft {
  fields: ProductDraftFields;
  step: number;
  savedAt: string;
}

function keyFor(productId: string | null | undefined): string {
  return `${LS_PREFIX}${productId && productId.trim() ? productId : 'new'}`;
}

export const productDraftService = {
  load(productId: string | null | undefined): ProductDraft | null {
    try {
      const raw = localStorage.getItem(keyFor(productId));
      return raw ? (JSON.parse(raw) as ProductDraft) : null;
    } catch {
      return null;
    }
  },

  save(productId: string | null | undefined, draft: Omit<ProductDraft, 'savedAt'>): string {
    const savedAt = new Date().toISOString();
    try {
      localStorage.setItem(keyFor(productId), JSON.stringify({ ...draft, savedAt }));
    } catch {
      /* quota / unavailable */
    }
    return savedAt;
  },

  clear(productId: string | null | undefined): void {
    try {
      localStorage.removeItem(keyFor(productId));
    } catch {
      /* ignore */
    }
  },
};
