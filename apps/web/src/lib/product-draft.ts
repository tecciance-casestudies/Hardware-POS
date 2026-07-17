'use client';

/**
 * Product-wizard draft persistence (wizard progress only).
 *
 * "Save draft" persists the product itself server-side (POST/PATCH /products
 * with isDraft: true), so drafts survive across browsers and appear in the
 * products table. This module only keeps the wizard's local progress — form
 * fields, product type, current step, and the id of the server draft — so a
 * refresh or accidental navigation resumes exactly where the user left off.
 * Components never touch localStorage directly.
 */

const LS_PREFIX = 'hpos.productDraft.';

export interface ProductDraftFields {
  name: string;
  sku: string;
  barcode: string;
  baseSku: string;
  batchCode: string;
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

export interface ProductDraft {
  fields: ProductDraftFields;
  productType: 'simple' | 'variations';
  step: number;
  savedAt: string;
  /** Server product id created by "Save draft" — re-saves update it in place. */
  serverProductId?: string | null;
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

  save(
    productId: string | null | undefined,
    draft: Omit<ProductDraft, 'savedAt'>,
  ): string {
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

  /** Move a "new" draft onto a real product id after creation (parity with variations). */
  promoteDraft(productId: string): void {
    try {
      const draft = localStorage.getItem(keyFor(null));
      if (draft) localStorage.removeItem(keyFor(null));
      // Intentionally not copied onto the created product — it's now server-backed.
      void productId;
      void draft;
    } catch {
      /* ignore */
    }
  },
};
