'use client';

import * as React from 'react';

import { MOCK_PRODUCTS } from './mock-data';

export type SyncState = 'SYNCED' | 'SYNCING' | 'FAILED' | 'PENDING' | 'NOT_SYNCED';

export interface QbCompany {
  name: string;
  realmId: string;
  environment: string;
}

export interface QbProduct {
  id: string;
  name: string;
  sku: string;
  quickbooksItemId: string;
  unitPrice: number;
  quantityOnHand: number;
  syncStatus: SyncState;
  lastSyncISO: string | null;
}

export type QbLogType = 'PRODUCT_PULL' | 'SALE_PUSH' | 'CUSTOMER_PULL' | 'CONNECTION';

export interface QbLogEntry {
  id: string;
  tsISO: string;
  type: QbLogType;
  direction: 'INBOUND' | 'OUTBOUND';
  status: SyncState;
  message: string;
}

export interface QbState {
  connected: boolean;
  company: QbCompany | null;
  connectedAtISO: string | null;
  lastSyncISO: string | null;
  productSync: { status: SyncState; count: number; lastSyncISO: string | null };
  salesSync: { status: SyncState; pushed: number; lastSyncISO: string | null };
  errorsCount: number;
  log: QbLogEntry[];
  products: QbProduct[];
}

const STORAGE_KEY = 'hpos.quickbooks';

const SEED_PRODUCTS: QbProduct[] = MOCK_PRODUCTS.map((p, i) => ({
  id: p.id,
  name: p.name,
  sku: p.sku,
  quickbooksItemId: `QBO-ITEM-${1001 + i}`,
  unitPrice: p.unitPrice,
  quantityOnHand: p.quantityOnHand,
  syncStatus: 'SYNCED',
  lastSyncISO: '2026-07-09T09:42:00Z',
}));

const SEED_LOG: QbLogEntry[] = [
  { id: 'l1', tsISO: '2026-07-09T09:42:00Z', type: 'PRODUCT_PULL', direction: 'INBOUND', status: 'SYNCED', message: 'Pulled 10 products, prices and stock' },
  { id: 'l2', tsISO: '2026-07-09T09:40:00Z', type: 'SALE_PUSH', direction: 'OUTBOUND', status: 'SYNCED', message: 'Sales Receipt QBO-SR-S-000012 created' },
  { id: 'l3', tsISO: '2026-07-09T09:38:00Z', type: 'SALE_PUSH', direction: 'OUTBOUND', status: 'FAILED', message: 'Invoice sync failed: token refresh required (will retry)' },
  { id: 'l4', tsISO: '2026-07-09T08:15:00Z', type: 'CONNECTION', direction: 'INBOUND', status: 'SYNCED', message: 'Connected to Hardware Store Demo Co.' },
];

/** Default (seeded connected) state — deterministic so SSR and first client render match. */
const CONNECTED_STATE: QbState = {
  connected: true,
  company: { name: 'Hardware Store Demo Co.', realmId: '9341452786538291', environment: 'Sandbox' },
  connectedAtISO: '2026-07-09T08:15:00Z',
  lastSyncISO: '2026-07-09T09:42:00Z',
  productSync: { status: 'SYNCED', count: 10, lastSyncISO: '2026-07-09T09:42:00Z' },
  salesSync: { status: 'SYNCED', pushed: 24, lastSyncISO: '2026-07-09T09:40:00Z' },
  errorsCount: 1,
  log: SEED_LOG,
  products: SEED_PRODUCTS,
};

const DISCONNECTED_STATE: QbState = {
  connected: false,
  company: null,
  connectedAtISO: null,
  lastSyncISO: null,
  productSync: { status: 'NOT_SYNCED', count: 0, lastSyncISO: null },
  salesSync: { status: 'NOT_SYNCED', pushed: 0, lastSyncISO: null },
  errorsCount: 0,
  log: [],
  products: [],
};

function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface QuickBooksContextValue {
  state: QbState;
  connect: () => void;
  disconnect: () => void;
  syncProducts: () => void;
}

const QuickBooksContext = React.createContext<QuickBooksContextValue | null>(null);

export function QuickBooksProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<QbState>(CONNECTED_STATE);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw) as QbState);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const runProductSync = React.useCallback(() => {
    setState((s) => ({ ...s, productSync: { ...s.productSync, status: 'SYNCING' } }));
    window.setTimeout(() => {
      const nowISO = new Date().toISOString();
      setState((s) => ({
        ...s,
        lastSyncISO: nowISO,
        productSync: { status: 'SYNCED', count: s.products.length, lastSyncISO: nowISO },
        products: s.products.map((p) => ({ ...p, syncStatus: 'SYNCED', lastSyncISO: nowISO })),
        log: [
          {
            id: rid(),
            tsISO: nowISO,
            type: 'PRODUCT_PULL',
            direction: 'INBOUND',
            status: 'SYNCED',
            message: `Pulled ${s.products.length} products, prices and stock`,
          },
          ...s.log,
        ],
      }));
    }, 1200);
  }, []);

  const connect = React.useCallback(() => {
    const nowISO = new Date().toISOString();
    setState({
      ...CONNECTED_STATE,
      connectedAtISO: nowISO,
      lastSyncISO: nowISO,
      errorsCount: 0,
      log: [
        {
          id: rid(),
          tsISO: nowISO,
          type: 'CONNECTION',
          direction: 'INBOUND',
          status: 'SYNCED',
          message: 'Connected to Hardware Store Demo Co. (simulated)',
        },
      ],
      products: SEED_PRODUCTS.map((p) => ({ ...p, lastSyncISO: nowISO })),
      productSync: { status: 'SYNCED', count: SEED_PRODUCTS.length, lastSyncISO: nowISO },
      salesSync: { status: 'PENDING', pushed: 0, lastSyncISO: null },
    });
  }, []);

  const disconnect = React.useCallback(() => setState(DISCONNECTED_STATE), []);

  const value = React.useMemo(
    () => ({ state, connect, disconnect, syncProducts: runProductSync }),
    [state, connect, disconnect, runProductSync],
  );

  return <QuickBooksContext.Provider value={value}>{children}</QuickBooksContext.Provider>;
}

export function useQuickBooks(): QuickBooksContextValue {
  const ctx = React.useContext(QuickBooksContext);
  if (!ctx) throw new Error('useQuickBooks must be used within a QuickBooksProvider');
  return ctx;
}

/** Deterministic timestamp formatting (avoids locale/timezone hydration issues). */
export function formatQbTime(iso: string | null): string {
  if (!iso) return '—';
  return iso.replace('T', ' ').slice(0, 16) + ' UTC';
}
