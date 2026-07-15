'use client';

import { DEFAULT_CURRENCY } from '@hardware-pos/shared';
import * as React from 'react';

import { api } from './api';
import type { Session } from './auth';

export interface ClientProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  categoryName: string;
  unitType: string | null;
  unitPrice: number;
  quantityOnHand: number;
  requiresWarehousePickup: boolean;
  imageUrl: string | null;
}

export interface ClientCustomer {
  id: string;
  name: string;
}

export interface PosSettings {
  currency: string;
  taxRatePercent: number;
}

interface ApiProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  categoryId: string | null;
  unitType: string | null;
  unitPrice: string | number;
  quantityOnHand: string | number;
  requiresWarehousePickup: boolean;
  imageUrl: string | null;
}

interface ApiCategory {
  id: string;
  name: string;
}

const DEFAULT_SETTINGS: PosSettings = { currency: DEFAULT_CURRENCY, taxRatePercent: 0 };

export interface CheckoutData {
  loading: boolean;
  /** Non-null when the catalog failed to load from the API. */
  error: string | null;
  products: ClientProduct[];
  categories: string[];
  settings: PosSettings;
  /** Re-fetch the catalog (e.g. after the API comes back up). */
  reload: () => void;
}

function deriveCategories(products: ClientProduct[]): string[] {
  return Array.from(new Set(products.map((p) => p.categoryName))).sort();
}

function normalizeApi(p: ApiProduct, catNames: Map<string, string>): ClientProduct {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    categoryName: (p.categoryId && catNames.get(p.categoryId)) || 'Uncategorized',
    unitType: p.unitType,
    unitPrice: Number(p.unitPrice),
    quantityOnHand: Number(p.quantityOnHand),
    requiresWarehousePickup: p.requiresWarehousePickup,
    imageUrl: p.imageUrl,
  };
}

/** Loads catalog data for the checkout screen from the backend product API. */
export function useCheckoutData(session: Session): CheckoutData {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const reload = React.useCallback(() => setRefreshKey((k) => k + 1), []);

  const [data, setData] = React.useState<Omit<CheckoutData, 'reload'>>({
    loading: true,
    error: null,
    products: [],
    categories: [],
    settings: DEFAULT_SETTINGS,
  });

  const token = session.token;
  const tenantId = session.user.tenantId;

  React.useEffect(() => {
    let cancelled = false;
    const auth = { token, tenantId };
    setData((prev) => ({ ...prev, loading: true, error: null }));

    (async () => {
      try {
        const [prod, cats, settings] = await Promise.all([
          api.get<{ items: ApiProduct[] }>('/products?pageSize=200', auth),
          api.get<ApiCategory[]>('/categories', auth),
          api.get<PosSettings>('/settings', auth),
        ]);
        if (cancelled) return;
        const catNames = new Map(cats.map((c) => [c.id, c.name]));
        const products = prod.items.map((p) => normalizeApi(p, catNames));
        setData({
          loading: false,
          error: null,
          products,
          categories: deriveCategories(products),
          settings,
        });
      } catch (err) {
        if (cancelled) return;
        setData({
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load the product catalog',
          products: [],
          categories: [],
          settings: DEFAULT_SETTINGS,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, tenantId, refreshKey]);

  return React.useMemo(() => ({ ...data, reload }), [data, reload]);
}
