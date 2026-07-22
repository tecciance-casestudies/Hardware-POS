import { describe, expect, it } from 'vitest';

import type { PaymentMethodTotal, RankedCategoryApi } from '@/lib/dashboard-api';

import {
  buildCategoryBars,
  buildPaymentBreakdown,
  createAccessibleChartSummary,
  formatDashboardPercentage,
} from './chart-tokens';

const pm = (method: string, amount: number, count = 0): PaymentMethodTotal => ({
  method,
  amount,
  count,
});
const cat = (label: string, amount: number, units = 0, count = 0): RankedCategoryApi => ({
  label,
  amount,
  units,
  count,
});

describe('buildPaymentBreakdown', () => {
  it('splits multiple methods with shares summing to 100%', () => {
    const bd = buildPaymentBreakdown(
      [pm('CASH', 125_500, 14), pm('CARD', 72_400, 8), pm('BANK_TRANSFER', 27_000, 3)],
      'amount',
    );
    expect(bd.slices).toHaveLength(3);
    expect(bd.total).toBe(224_900);
    const sum = bd.slices.reduce((s, x) => s + x.fraction, 0);
    expect(sum).toBeCloseTo(1, 6);
    expect(bd.singleMethod).toBe(false);
    // Sorted by amount desc.
    expect(bd.slices.map((s) => s.label)).toEqual(['Cash', 'Card', 'Bank Transfer']);
  });

  it('handles a single method at 100%', () => {
    const bd = buildPaymentBreakdown([pm('CASH', 251_165, 27)], 'amount');
    expect(bd.singleMethod).toBe(true);
    expect(bd.slices).toHaveLength(1);
    expect(bd.slices[0]?.fraction).toBe(1);
    expect(formatDashboardPercentage(bd.slices[0]!.fraction)).toBe('100%');
  });

  it('returns an empty breakdown for no data (no fake ring)', () => {
    expect(buildPaymentBreakdown([], 'amount').slices).toHaveLength(0);
    expect(buildPaymentBreakdown([pm('CASH', 0, 0)], 'amount').slices).toHaveLength(0);
  });

  it('groups methods beyond the fifth into a single Other slice', () => {
    const bd = buildPaymentBreakdown(
      [
        pm('CASH', 100),
        pm('CARD', 80),
        pm('BANK_TRANSFER', 60),
        pm('QR_PAYMENT', 40),
        pm('STORE_CREDIT', 20),
        pm('CHECK', 10),
        pm('SPLIT', 5),
      ],
      'amount',
    );
    expect(bd.slices).toHaveLength(6);
    const other = bd.slices[bd.slices.length - 1];
    expect(other?.key).toBe('__other__');
    expect(other?.amount).toBe(15); // 10 + 5
  });

  it('re-weights by transaction count under the transactions metric', () => {
    const bd = buildPaymentBreakdown([pm('CASH', 100, 2), pm('CARD', 50, 8)], 'transactions');
    // By count, Card (8) leads Cash (2).
    expect(bd.slices[0]?.label).toBe('Card');
    expect(bd.total).toBe(10);
    expect(bd.slices[0]?.fraction).toBeCloseTo(0.8, 6);
    // Amount total stays available for the centre regardless of metric.
    expect(bd.totalAmount).toBe(150);
  });

  it('ignores negative/refund amounts when computing shares', () => {
    const bd = buildPaymentBreakdown([pm('CASH', 100, 1), pm('CARD', -20, 1)], 'amount');
    expect(bd.slices).toHaveLength(1);
    expect(bd.slices[0]?.fraction).toBe(1);
  });
});

describe('buildCategoryBars', () => {
  const categories = [
    cat('Building Materials', 147_950, 300, 40),
    cat('Paint & Supplies', 41_640, 120, 22),
    cat('Lanka Tile', 34_200, 90, 15),
  ];

  it('ranks descending and computes contribution + ratio', () => {
    const bars = buildCategoryBars(categories, 'amount');
    expect(bars.map((b) => b.rank)).toEqual([1, 2, 3]);
    expect(bars[0]?.ratio).toBe(1); // leader
    const contribSum = bars.reduce((s, b) => s + b.contribution, 0);
    expect(contribSum).toBeCloseTo(1, 6);
    expect(bars[0]?.contribution).toBeCloseTo(147_950 / 223_790, 6);
  });

  it('re-sorts when the metric changes (units)', () => {
    const bars = buildCategoryBars(categories, 'units');
    expect(bars[0]?.label).toBe('Building Materials');
    expect(bars[0]?.metricValue).toBe(300);
  });

  it('handles fewer than five categories and drops empty ones', () => {
    const bars = buildCategoryBars([cat('One', 10, 1, 1), cat('Zero', 0, 0, 0)], 'amount');
    expect(bars).toHaveLength(1);
  });
});

describe('formatDashboardPercentage', () => {
  it('keeps one decimal for sub-1% slices so they never read as 0%', () => {
    expect(formatDashboardPercentage(0.004)).toBe('0.4%');
  });
  it('rounds whole numbers for larger shares', () => {
    expect(formatDashboardPercentage(0.29)).toBe('29%');
    expect(formatDashboardPercentage(1)).toBe('100%');
  });
  it('guards zero / non-finite', () => {
    expect(formatDashboardPercentage(0)).toBe('0%');
    expect(formatDashboardPercentage(Number.NaN)).toBe('0%');
  });
});

describe('createAccessibleChartSummary', () => {
  it('names the leader then follows with the rest', () => {
    const s = createAccessibleChartSummary('Payment split.', [
      { label: 'Cash', fraction: 0.5 },
      { label: 'Card', fraction: 0.29 },
      { label: 'Bank Transfer', fraction: 0.11 },
    ]);
    expect(s).toContain('Cash represents 50%');
    expect(s).toContain('followed by Bank Transfer at 11%');
  });
  it('states when there is no data', () => {
    expect(createAccessibleChartSummary('Payment split.', [])).toContain('No data');
  });
});
