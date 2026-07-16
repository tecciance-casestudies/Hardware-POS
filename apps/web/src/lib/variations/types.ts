/**
 * Product variation types — FRONTEND-ONLY.
 *
 * None of this exists server-side. The backend `Product` has a single SKU / price /
 * stock. Variations are an entirely local extension persisted in the browser (see
 * `variation-store.ts`). Keep these types isolated from `products-api.ts` payloads.
 *
 * TODO(backend): a real implementation would add a `ProductVariant` model
 *   (productId, optionValues, sku, barcode, price, cost, stock, reorderLevel, active,
 *    imageUrl) plus attribute/option tables, and endpoints to CRUD them.
 */

/** A single selectable value inside an attribute (e.g. "Red"). */
export interface VariationOption {
  id: string;
  value: string;
}

/** A variation axis (e.g. "Color") with its option values. */
export interface VariationAttribute {
  id: string;
  name: string;
  options: VariationOption[];
}

/** How selling price is derived for variants. */
export type PriceMode =
  | 'single' // one price for all variants (base product price)
  | 'base-overrides' // base price, custom overrides on selected variants
  | 'individual'; // every variant carries its own price

/** A generated variant (one cell of the attribute Cartesian product). */
export interface Variant {
  /** Stable, order-independent key derived from option ids. Survives regeneration. */
  key: string;
  /** attributeId -> optionId, capturing exactly which options this variant combines. */
  selections: Record<string, string>;
  sku: string;
  barcode: string;
  /** null = "uses base price". A number = a custom override / individual price. */
  price: number | null;
  cost: number | null;
  stock: number;
  reorderLevel: number | null;
  active: boolean;
  imageUrl: string | null;
  note: string;
}

/** The full frontend-only variation extension for one product. */
export interface ProductVariationData {
  enabled: boolean;
  attributes: VariationAttribute[];
  variants: Variant[];
  priceMode: PriceMode;
  /** Attribute id to group the matrix by, or null for a flat list. */
  groupBy: string | null;
  /** ISO timestamp of the last local save (stamped by the service). */
  updatedAt: string | null;
}

export function emptyVariationData(): ProductVariationData {
  return {
    enabled: false,
    attributes: [],
    variants: [],
    priceMode: 'base-overrides',
    groupBy: null,
    updatedAt: null,
  };
}
