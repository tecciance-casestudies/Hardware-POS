/**
 * DEV-ONLY demo adapters.
 *
 * These back the dashboard panels that have no production API yet (profit,
 * period comparisons, sales timeseries, payment-method split, top categories,
 * shift summary, frequently-sold items). Every value here is static, clearly
 * flagged `isDemo`, and rendered behind a visible "Demo" badge with a
 * production-safe empty state — it is NEVER merged into real API queries.
 *
 * TODO(api): replace each function below with a real aggregation endpoint and
 * delete this module. See /docs/role-based-dashboard-ui-plan.md §9.
 */
import type {
  BreakdownRow,
  FrequentItem,
  MetricComparison,
  RankedRow,
  ShiftSummary,
} from './types';

/** Static so SSR and client render identically (no hydration drift). */
const SPARK_UP = [12, 14, 13, 16, 15, 19, 22, 21, 24, 27];
const SPARK_STEADY = [20, 19, 21, 20, 22, 21, 23, 22, 24, 23];
const SPARK_DOWN = [28, 27, 25, 26, 24, 23, 24, 22, 21, 20];

export function demoSpark(kind: 'up' | 'steady' | 'down' = 'up'): number[] {
  return kind === 'down' ? SPARK_DOWN : kind === 'steady' ? SPARK_STEADY : SPARK_UP;
}

export function demoComparison(value: number, label: string): MetricComparison {
  return { value, direction: value > 0 ? 'up' : value < 0 ? 'down' : 'neutral', label };
}

/** Demo gross-profit figure derived as a plausible margin of a real sales value. */
export function demoGrossProfit(netSales: number): number {
  return Math.round(netSales * 0.34);
}

/** 7 evenly-spaced demo points for the Sales Performance chart. */
export function demoSalesSeries(): { label: string; value: number }[] {
  const values = [148000, 132000, 205000, 198000, 232000, 226000, 208000];
  return values.map((value, i) => ({ label: `Day ${i + 1}`, value }));
}

export function demoPaymentBreakdown(): BreakdownRow[] {
  return [
    { key: 'cash', label: 'Cash', amount: 58240, percent: 45, tone: 'cash' },
    { key: 'card', label: 'Card', amount: 46150, percent: 36, tone: 'card' },
    { key: 'bank', label: 'Bank Transfer', amount: 16330, percent: 13, tone: 'bank' },
    { key: 'qr', label: 'QR / Wallet', amount: 7730, percent: 6, tone: 'qr' },
  ];
}

export function demoTopCategories(): RankedRow[] {
  return [
    { key: 'building', label: 'Building Materials', amount: 512430, percent: 41 },
    { key: 'electrical', label: 'Electrical', amount: 298750, percent: 24 },
    { key: 'paint', label: 'Paint & Supplies', amount: 186950, percent: 15 },
    { key: 'hardware', label: 'Hardware & Fittings', amount: 142870, percent: 11 },
    { key: 'plumbing', label: 'Plumbing', amount: 107950, percent: 9 },
  ];
}

export function demoFrequentItems(): FrequentItem[] {
  return [
    { key: '1', name: 'Nylon Cable Tie', imageUrl: null, quantity: 48, amount: 120 },
    { key: '2', name: 'LED Bulb 12W', imageUrl: null, quantity: 36, amount: 420 },
    { key: '3', name: 'PVC Pipe 1/2"', imageUrl: null, quantity: 28, amount: 180 },
    { key: '4', name: 'Masking Tape 2"', imageUrl: null, quantity: 20, amount: 210 },
    { key: '5', name: 'Screw M4 x 25mm', imageUrl: null, quantity: 18, amount: 45 },
  ];
}

export function demoShiftSummary(): ShiftSummary {
  const cashSales = 58240;
  const startingCash = 25000;
  const refunds = 2180;
  const expectedCash = startingCash + cashSales - refunds;
  const drawerBalance = 54680;
  return {
    isOpen: true,
    startedAtLabel: 'Today, 8:00 AM',
    startingCash,
    cashSales,
    cardSales: 46150,
    bankQrSales: 16330,
    refunds,
    expectedCash,
    drawerBalance,
    difference: drawerBalance - expectedCash,
  };
}
