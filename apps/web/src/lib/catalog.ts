'use client';

import * as React from 'react';

import { api } from './api';
import type { Session } from './auth';
import { MOCK_PRODUCTS } from './mock-data';

export interface ClientProduct {
  id: string;
  name: string;
  sku: string | null;
  categoryName: string;
  unitType: string | null;
  unitPrice: number;
  quantityOnHand: number;
  requiresWarehousePickup: boolean;
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
  categoryId: string | null;
  unitType: string | null;
  unitPrice: string | number;
  quantityOnHand: string | number;
  requiresWarehousePickup: boolean;
}

interface ApiCategory {
  id: string;
  name: string;
}

const DEFAULT_SETTINGS: PosSettings = { currency: 'USD', taxRatePercent: 0 };

const MOCK_CUSTOMERS: ClientCustomer[] = [
  { id: 'cus_acme', name: 'Acme Builders' },
  { id: 'cus_north', name: 'Northside Contractors' },
];

export interface CheckoutData {
  loading: boolean;
  /** 'api' when live data loaded, 'mock' when the offline fallback is used. */
  source: 'api' | 'mock';
  products: ClientProduct[];
  categories: string[];
  customers: ClientCustomer[];
  settings: PosSettings;
}

function deriveCategories(products: ClientProduct[]): string[] {
  return Array.from(new Set(products.map((p) => p.categoryName))).sort();
}

function normalizeApi(p: ApiProduct, catNames: Map<string, string>): ClientProduct {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    categoryName: (p.categoryId && catNames.get(p.categoryId)) || 'Uncategorized',
    unitType: p.unitType,
    unitPrice: Number(p.unitPrice),
    quantityOnHand: Number(p.quantityOnHand),
    requiresWarehousePickup: p.requiresWarehousePickup,
  };
}

const MOCK_AS_CLIENT: ClientProduct[] = MOCK_PRODUCTS.map((p) => ({
  id: p.id,
  name: p.name,
  sku: p.sku,
  categoryName: p.category,
  unitType: p.unitType,
  unitPrice: p.unitPrice,
  quantityOnHand: p.quantityOnHand,
  requiresWarehousePickup: p.requiresWarehousePickup,
}));

/**
 * Loads catalog data for the checkout screen from the backend product API,
 * falling back to bundled mock data when the API is unreachable/unauthenticated
 * (e.g. the offline demo session).
 */
export function useCheckoutData(session: Session): CheckoutData {
  const [data, setData] = React.useState<CheckoutData>({
    loading: true,
    source: 'api',
    products: [],
    categories: [],
    customers: [],
    settings: DEFAULT_SETTINGS,
  });

  const token = session.token;
  const tenantId = session.user.tenantId;

  React.useEffect(() => {
    let cancelled = false;
    const auth = { token, tenantId };

    (async () => {
      try {
        const [prod, cats, custs, settings] = await Promise.all([
          api.get<{ items: ApiProduct[] }>('/products?pageSize=200', auth),
          api.get<ApiCategory[]>('/categories', auth),
          api.get<{ items: ClientCustomer[] }>('/customers?pageSize=200', auth),
          api.get<PosSettings>('/settings', auth),
        ]);
        if (cancelled) return;
        const catNames = new Map(cats.map((c) => [c.id, c.name]));
        const products = prod.items.map((p) => normalizeApi(p, catNames));
        setData({
          loading: false,
          source: 'api',
          products,
          categories: deriveCategories(products),
          customers: custs.items,
          settings,
        });
      } catch {
        if (cancelled) return;
        setData({
          loading: false,
          source: 'mock',
          products: MOCK_AS_CLIENT,
          categories: deriveCategories(MOCK_AS_CLIENT),
          customers: MOCK_CUSTOMERS,
          settings: DEFAULT_SETTINGS,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, tenantId]);

  return data;
}
