'use client';

/**
 * Frontend-only product-wizard draft persistence.
 *
 * Saves the in-progress wizard (form fields + product type + current step) to
 * localStorage so a refresh or accidental navigation doesn't lose work. Mirrors
 * the `categoryAssignmentService` / `variationMockService` pattern — components
 * never touch localStorage directly. Variation data persists separately via
 * `variationMockService`; this only covers the plain product fields + wizard progress.
 *
 * TODO(backend): a real "save draft" would POST an unpublished product; until then
 * drafts live only in this browser.
 */

const LS_PREFIX = 'hpos.productDraft.';

export interface ProductDraftFields {
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

export interface ProductDraft {
  fields: ProductDraftFields;
  productType: 'simple' | 'variations';
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
