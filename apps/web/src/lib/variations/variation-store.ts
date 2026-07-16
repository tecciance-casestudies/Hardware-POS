'use client';

/**
 * Frontend-only variation persistence + a React store hook.
 *
 * Three layers, mirroring `categoryAssignmentService`, so components NEVER touch
 * localStorage directly:
 *   productExtensionAdapter  – raw namespaced localStorage IO, keyed per product
 *   variationMockService     – load / persist / generate operations
 *   variationStore           – `useVariationStore` React hook (in-memory + persist)
 *
 * TODO(backend): replace the adapter/service with real endpoints:
 *   GET/PUT /products/:id/variation-config   (attributes, price mode, group pref)
 *   GET/POST/PATCH/DELETE /products/:id/variants
 * Until then everything here is local to the browser/tenant.
 */

import * as React from 'react';

import {
  analyzeAttributes,
  buildVariants,
  combinationKey,
  diffVariants,
} from './variation-combination-utils';
import {
  emptyVariationData,
  type PriceMode,
  type ProductVariationData,
  type Variant,
  type VariationAttribute,
  type VariationOption,
} from './types';

const LS_PREFIX = 'hpos.productVariations.';

/** Deterministic-enough unique id for client-side use. */
let seq = 0;
function uid(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}${(seq++).toString(36)}`;
}

/** Storage key for a product; create-mode drafts share a single draft key. */
function keyFor(productId: string | null | undefined): string {
  return `${LS_PREFIX}${productId && productId.trim() ? productId : 'draft'}`;
}

// ---------------------------------------------------------------------------
// productExtensionAdapter — raw localStorage IO
// ---------------------------------------------------------------------------

export const productExtensionAdapter = {
  read(productId: string | null | undefined): ProductVariationData | null {
    try {
      const raw = localStorage.getItem(keyFor(productId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<ProductVariationData>;
      return { ...emptyVariationData(), ...parsed };
    } catch {
      return null;
    }
  },

  write(productId: string | null | undefined, data: ProductVariationData): boolean {
    try {
      localStorage.setItem(keyFor(productId), JSON.stringify(data));
      return true;
    } catch {
      return false; // quota / unavailable storage
    }
  },

  remove(productId: string | null | undefined): void {
    try {
      localStorage.removeItem(keyFor(productId));
    } catch {
      /* ignore */
    }
  },

  /** Move draft data onto a real product id after creation. */
  promoteDraft(productId: string): void {
    try {
      const draft = localStorage.getItem(keyFor(null));
      if (draft) {
        localStorage.setItem(keyFor(productId), draft);
        localStorage.removeItem(keyFor(null));
      }
    } catch {
      /* ignore */
    }
  },
};

// ---------------------------------------------------------------------------
// variationMockService — operations on top of the adapter
// ---------------------------------------------------------------------------

export const variationMockService = {
  load(productId: string | null | undefined): ProductVariationData {
    return productExtensionAdapter.read(productId) ?? emptyVariationData();
  },

  persist(
    productId: string | null | undefined,
    data: ProductVariationData,
  ): { ok: boolean; savedAt: string } {
    const savedAt = new Date().toISOString();
    const ok = productExtensionAdapter.write(productId, { ...data, updatedAt: savedAt });
    return { ok, savedAt };
  },

  promoteDraft: productExtensionAdapter.promoteDraft,
  clear: productExtensionAdapter.remove,
};

// ---------------------------------------------------------------------------
// Attribute / option / variant factories & pure reducers
// ---------------------------------------------------------------------------

function makeOption(value: string): VariationOption {
  return { id: uid('opt'), value: value.trim() };
}

function makeAttribute(name = ''): VariationAttribute {
  return { id: uid('attr'), name, options: [] };
}

const normalize = (s: string) => s.trim().toLowerCase();

// ---------------------------------------------------------------------------
// variationStore — the React hook
// ---------------------------------------------------------------------------

export interface GenerateResult {
  added: number;
  removed: number;
  unchanged: number;
}

export interface VariationStore {
  data: ProductVariationData;
  saving: boolean;
  lastSavedAt: string | null;
  /** Live analysis of the current attributes (counts + warnings). */
  analysis: ReturnType<typeof analyzeAttributes>;

  setEnabled: (enabled: boolean) => void;
  setPriceMode: (mode: PriceMode) => void;
  setGroupBy: (attributeId: string | null) => void;

  addAttribute: (name?: string) => string;
  renameAttribute: (id: string, name: string) => void;
  removeAttribute: (id: string) => void;
  duplicateAttribute: (id: string) => void;
  moveAttribute: (id: string, dir: 'up' | 'down') => void;

  /** Add one or many (comma-split) option values; returns rejected duplicates. */
  addOptions: (attributeId: string, raw: string) => string[];
  removeOption: (attributeId: string, optionId: string) => void;

  /** Preview what generate/regenerate would change without mutating. */
  previewGenerate: () => ReturnType<typeof diffVariants>;
  generate: (baseSku: string) => GenerateResult;

  updateVariant: (key: string, patch: Partial<Variant>) => void;
  bulkUpdate: (keys: string[], patch: (v: Variant) => Partial<Variant>) => void;
  removeVariant: (key: string) => void;

  reset: () => void;
}

export function useVariationStore(
  productId: string | null | undefined,
): VariationStore {
  const [data, setData] = React.useState<ProductVariationData>(() => emptyVariationData());
  const [saving, setSaving] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  // True right after a load so the immediately-following persist is skipped — we
  // must never write the freshly-loaded value back over itself on mount.
  const skipNextPersist = React.useRef(true);

  // Load once on mount / when the product id changes.
  React.useEffect(() => {
    const initial = variationMockService.load(productId);
    skipNextPersist.current = true;
    setData(initial);
    setLastSavedAt(initial.updatedAt);
  }, [productId]);

  // Persist on change (skip the load itself). Debounced to avoid thrashing.
  React.useEffect(() => {
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    setSaving(true);
    const t = setTimeout(() => {
      const { savedAt } = variationMockService.persist(productId, data);
      setLastSavedAt(savedAt);
      setSaving(false);
    }, 350);
    return () => clearTimeout(t);
  }, [data, productId]);

  const analysis = React.useMemo(() => analyzeAttributes(data.attributes), [data.attributes]);

  const mutate = React.useCallback(
    (fn: (d: ProductVariationData) => ProductVariationData) => setData((d) => fn(d)),
    [],
  );

  const setEnabled = React.useCallback(
    (enabled: boolean) => mutate((d) => ({ ...d, enabled })),
    [mutate],
  );

  const setPriceMode = React.useCallback(
    (priceMode: PriceMode) => mutate((d) => ({ ...d, priceMode })),
    [mutate],
  );

  const setGroupBy = React.useCallback(
    (groupBy: string | null) => mutate((d) => ({ ...d, groupBy })),
    [mutate],
  );

  const addAttribute = React.useCallback(
    (name = '') => {
      const attr = makeAttribute(name);
      mutate((d) => ({ ...d, attributes: [...d.attributes, attr] }));
      return attr.id;
    },
    [mutate],
  );

  const renameAttribute = React.useCallback(
    (id: string, name: string) =>
      mutate((d) => ({
        ...d,
        attributes: d.attributes.map((a) => (a.id === id ? { ...a, name } : a)),
      })),
    [mutate],
  );

  const removeAttribute = React.useCallback(
    (id: string) =>
      mutate((d) => ({
        ...d,
        attributes: d.attributes.filter((a) => a.id !== id),
        groupBy: d.groupBy === id ? null : d.groupBy,
      })),
    [mutate],
  );

  const duplicateAttribute = React.useCallback(
    (id: string) =>
      mutate((d) => {
        const idx = d.attributes.findIndex((a) => a.id === id);
        const src = idx < 0 ? undefined : d.attributes[idx];
        if (!src) return d;
        const copy: VariationAttribute = {
          id: uid('attr'),
          name: `${src.name} copy`.trim(),
          options: src.options.map((o) => ({ id: uid('opt'), value: o.value })),
        };
        const next = d.attributes.slice();
        next.splice(idx + 1, 0, copy);
        return { ...d, attributes: next };
      }),
    [mutate],
  );

  const moveAttribute = React.useCallback(
    (id: string, dir: 'up' | 'down') =>
      mutate((d) => {
        const idx = d.attributes.findIndex((a) => a.id === id);
        if (idx < 0) return d;
        const target = dir === 'up' ? idx - 1 : idx + 1;
        if (target < 0 || target >= d.attributes.length) return d;
        const next = d.attributes.slice();
        const a = next[idx];
        const b = next[target];
        if (!a || !b) return d;
        next[idx] = b;
        next[target] = a;
        return { ...d, attributes: next };
      }),
    [mutate],
  );

  const addOptions = React.useCallback(
    (attributeId: string, raw: string): string[] => {
      const rejected: string[] = [];
      mutate((d) => {
        const attributes = d.attributes.map((a) => {
          if (a.id !== attributeId) return a;
          const existing = new Set(a.options.map((o) => normalize(o.value)));
          const additions: VariationOption[] = [];
          for (const piece of raw.split(',')) {
            const value = piece.trim();
            if (!value) continue;
            const norm = normalize(value);
            if (existing.has(norm)) {
              rejected.push(value);
              continue;
            }
            existing.add(norm);
            additions.push(makeOption(value));
          }
          return additions.length ? { ...a, options: [...a.options, ...additions] } : a;
        });
        return { ...d, attributes };
      });
      return rejected;
    },
    [mutate],
  );

  const removeOption = React.useCallback(
    (attributeId: string, optionId: string) =>
      mutate((d) => ({
        ...d,
        attributes: d.attributes.map((a) =>
          a.id === attributeId
            ? { ...a, options: a.options.filter((o) => o.id !== optionId) }
            : a,
        ),
      })),
    [mutate],
  );

  const previewGenerate = React.useCallback(
    () => diffVariants(data.variants, data.attributes),
    [data.variants, data.attributes],
  );

  const generate = React.useCallback(
    (baseSku: string): GenerateResult => {
      const before = diffVariants(data.variants, data.attributes);
      const variants = buildVariants({
        baseSku,
        attributes: data.attributes,
        existing: data.variants,
        generateSku: true,
      });
      mutate((d) => ({ ...d, variants, enabled: true }));
      return {
        added: before.addedKeys.length,
        removed: before.removed.length,
        unchanged: before.unchanged.length,
      };
    },
    [data.variants, data.attributes, mutate],
  );

  const updateVariant = React.useCallback(
    (key: string, patch: Partial<Variant>) =>
      mutate((d) => ({
        ...d,
        variants: d.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)),
      })),
    [mutate],
  );

  const bulkUpdate = React.useCallback(
    (keys: string[], patch: (v: Variant) => Partial<Variant>) => {
      const keySet = new Set(keys);
      mutate((d) => ({
        ...d,
        variants: d.variants.map((v) => (keySet.has(v.key) ? { ...v, ...patch(v) } : v)),
      }));
    },
    [mutate],
  );

  const removeVariant = React.useCallback(
    (key: string) =>
      mutate((d) => ({ ...d, variants: d.variants.filter((v) => v.key !== key) })),
    [mutate],
  );

  const reset = React.useCallback(() => mutate(() => emptyVariationData()), [mutate]);

  return {
    data,
    saving,
    lastSavedAt,
    analysis,
    setEnabled,
    setPriceMode,
    setGroupBy,
    addAttribute,
    renameAttribute,
    removeAttribute,
    duplicateAttribute,
    moveAttribute,
    addOptions,
    removeOption,
    previewGenerate,
    generate,
    updateVariant,
    bulkUpdate,
    removeVariant,
    reset,
  };
}

export { combinationKey };
