/**
 * variationCombinationUtils — pure, side-effect-free helpers for turning attributes
 * into variants. No React, no storage. Deterministic (no Date.now / Math.random) so
 * ids stay stable across re-renders and regeneration.
 */

import type {
  ProductVariationData,
  Variant,
  VariationAttribute,
  VariationOption,
} from './types';

/** Warn above this many combinations; below the hard cap. */
export const WARN_COMBINATION_COUNT = 100;
/** Strong warning above this many combinations. */
export const HIGH_COMBINATION_COUNT = 200;
/** Hard ceiling — generation refuses beyond this to keep the browser responsive. */
export const MAX_COMBINATIONS = 2000;

/** Attributes that actually contribute to the Cartesian product (>=1 option). */
function contributingAttributes(attributes: VariationAttribute[]): VariationAttribute[] {
  return attributes.filter((a) => a.options.length > 0);
}

/** Number of combinations the current attributes would produce (0 if none contribute). */
export function countCombinations(attributes: VariationAttribute[]): number {
  const contributing = contributingAttributes(attributes);
  if (contributing.length === 0) return 0;
  return contributing.reduce((acc, a) => acc * a.options.length, 1);
}

/**
 * Stable, order-independent key for a set of option selections. Built from the
 * option ids sorted by attribute id, so reordering attributes or renaming values
 * never changes the key — which is what lets us preserve edited data on regenerate.
 */
export function combinationKey(selections: Record<string, string>): string {
  return Object.keys(selections)
    .sort()
    .map((attrId) => `${attrId}:${selections[attrId]}`)
    .join('|');
}

/** The Cartesian product of all contributing attributes, as selection maps. */
export function cartesianSelections(
  attributes: VariationAttribute[],
): Record<string, string>[] {
  const contributing = contributingAttributes(attributes);
  if (contributing.length === 0) return [];

  let acc: Record<string, string>[] = [{}];
  for (const attr of contributing) {
    const next: Record<string, string>[] = [];
    for (const partial of acc) {
      for (const opt of attr.options) {
        next.push({ ...partial, [attr.id]: opt.id });
      }
    }
    acc = next;
  }
  return acc;
}

/** Human label for a variant, e.g. "Red / 60 × 30 cm / Matte" (attribute order). */
export function variantLabel(
  attributes: VariationAttribute[],
  selections: Record<string, string>,
): string {
  return attributes
    .map((attr) => {
      const optId = selections[attr.id];
      const opt = attr.options.find((o) => o.id === optId);
      return opt?.value;
    })
    .filter((v): v is string => !!v)
    .join(' / ');
}

/** Per-option chips for a variant, in attribute order. */
export function variantChips(
  attributes: VariationAttribute[],
  selections: Record<string, string>,
): { attribute: string; value: string }[] {
  return attributes
    .map((attr) => {
      const opt = attr.options.find((o) => o.id === selections[attr.id]);
      return opt ? { attribute: attr.name, value: opt.value } : null;
    })
    .filter((c): c is { attribute: string; value: string } => !!c);
}

/** Short token for an option value used in generated SKUs (e.g. "90×110 cm" -> "90X110"). */
function skuToken(value: string): string {
  const cleaned = value
    .toUpperCase()
    .replace(/×/g, 'X')
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 6);
  return cleaned || 'V';
}

/** Suggest a draft SKU from a base SKU + the variant's option values. */
export function suggestSku(
  baseSku: string,
  attributes: VariationAttribute[],
  selections: Record<string, string>,
): string {
  const base = baseSku.trim() || 'SKU';
  const tokens = attributes
    .map((attr) => {
      const opt = attr.options.find((o) => o.id === selections[attr.id]);
      return opt ? skuToken(opt.value) : null;
    })
    .filter((t): t is string => !!t);
  return [base, ...tokens].join('-');
}

export interface BuildOptions {
  baseSku: string;
  attributes: VariationAttribute[];
  /** Existing variants to preserve edited data from, matched by key. */
  existing?: Variant[];
  /** Auto-generate draft SKUs for newly created variants. */
  generateSku?: boolean;
}

/** Fresh variant with sensible defaults (active, base price, zero stock). */
function makeVariant(
  selections: Record<string, string>,
  sku: string,
): Variant {
  return {
    key: combinationKey(selections),
    selections,
    sku,
    barcode: '',
    price: null, // uses base price by default
    cost: null,
    stock: 0,
    reorderLevel: null,
    active: true,
    imageUrl: null,
    note: '',
  };
}

/**
 * Build the full variant list for the current attributes, preserving edited data
 * from any existing variant whose key still exists.
 */
export function buildVariants(opts: BuildOptions): Variant[] {
  const { attributes, existing = [], baseSku, generateSku = true } = opts;
  const existingByKey = new Map(existing.map((v) => [v.key, v]));

  return cartesianSelections(attributes).map((selections) => {
    const key = combinationKey(selections);
    const prior = existingByKey.get(key);
    if (prior) {
      // Preserve everything the user set; refresh selections reference only.
      return { ...prior, selections };
    }
    const sku = generateSku ? suggestSku(baseSku, attributes, selections) : '';
    return makeVariant(selections, sku);
  });
}

export interface VariantDiff {
  unchanged: Variant[];
  addedKeys: string[];
  removed: Variant[];
}

/**
 * Compare existing variants against what the current attributes would produce.
 * Used to power the "Regenerate safely" review before mutating anything.
 */
export function diffVariants(
  existing: Variant[],
  attributes: VariationAttribute[],
): VariantDiff {
  const nextKeys = new Set(cartesianSelections(attributes).map(combinationKey));
  const existingKeys = new Set(existing.map((v) => v.key));

  return {
    unchanged: existing.filter((v) => nextKeys.has(v.key)),
    addedKeys: [...nextKeys].filter((k) => !existingKeys.has(k)),
    removed: existing.filter((v) => !nextKeys.has(v.key)),
  };
}

export interface AttributeWarnings {
  emptyAttributes: string[]; // attribute names with no options
  duplicateAttributeNames: string[];
  duplicateOptionAttributes: string[]; // attribute names containing duplicate values
  count: number;
  overWarn: boolean;
  overHigh: boolean;
  overMax: boolean;
}

const norm = (s: string) => s.trim().toLowerCase();

/** All the validation signals the Combinations stage surfaces before generating. */
export function analyzeAttributes(attributes: VariationAttribute[]): AttributeWarnings {
  const emptyAttributes = attributes
    .filter((a) => a.name.trim() && a.options.length === 0)
    .map((a) => a.name.trim());

  const nameCounts = new Map<string, number>();
  for (const a of attributes) {
    const n = norm(a.name);
    if (!n) continue;
    nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
  }
  const duplicateAttributeNames = attributes
    .filter((a) => a.name.trim() && (nameCounts.get(norm(a.name)) ?? 0) > 1)
    .map((a) => a.name.trim())
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const duplicateOptionAttributes = attributes
    .filter((a) => {
      const seen = new Set<string>();
      return a.options.some((o) => {
        const v = norm(o.value);
        if (seen.has(v)) return true;
        seen.add(v);
        return false;
      });
    })
    .map((a) => a.name.trim() || 'Untitled');

  const count = countCombinations(attributes);

  return {
    emptyAttributes,
    duplicateAttributeNames,
    duplicateOptionAttributes,
    count,
    overWarn: count > WARN_COMBINATION_COUNT,
    overHigh: count > HIGH_COMBINATION_COUNT,
    overMax: count > MAX_COMBINATIONS,
  };
}

/** A concise "3 colors × 2 sizes = 6 variations" line for the summary. */
export function combinationFormula(attributes: VariationAttribute[]): string {
  const contributing = contributingAttributes(attributes);
  if (contributing.length === 0) return 'No options yet';
  const parts = contributing.map((a) => {
    const label = a.name.trim() || 'option';
    const plural = a.options.length === 1 ? label : `${label}s`;
    return `${a.options.length} ${plural.toLowerCase()}`;
  });
  const total = countCombinations(attributes);
  return `${parts.join(' × ')} = ${total} variation${total === 1 ? '' : 's'}`;
}

/**
 * Per-variant validation issues used for inline highlighting and the pre-save
 * "N variants need attention" summary. Price mode decides whether a price is required.
 */
export function variantValidationIssues(
  variant: Variant,
  priceMode: import('./types').PriceMode,
): string[] {
  const issues: string[] = [];
  if (priceMode === 'individual' && variant.price == null) {
    issues.push('Individual pricing requires a price');
  }
  if (variant.price != null && (Number.isNaN(variant.price) || variant.price < 0)) {
    issues.push('Price must be zero or more');
  }
  if (Number.isNaN(variant.stock) || variant.stock < 0) {
    issues.push('Stock must be zero or more');
  }
  return issues;
}

export const variationCombinationUtils = {
  countCombinations,
  combinationKey,
  cartesianSelections,
  variantLabel,
  variantChips,
  suggestSku,
  buildVariants,
  diffVariants,
  analyzeAttributes,
  combinationFormula,
  variantValidationIssues,
  WARN_COMBINATION_COUNT,
  HIGH_COMBINATION_COUNT,
  MAX_COMBINATIONS,
};

/** Convenience re-export so callers can pull the data type from one module. */
export type { ProductVariationData };
