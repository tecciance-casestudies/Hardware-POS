/**
 * Central dashboard chart tokens + pure data transforms.
 *
 * Colours are referenced as CSS custom properties (defined in globals.css) so
 * every chart re-themes automatically and no feature component ever hard-codes a
 * hex value. Data transforms are pure and framework-free — they turn raw API
 * rows into render-ready view models, keeping charts free of business math.
 */
import { formatMoney } from '@/lib/utils';
import type { PaymentMethodTotal, RankedCategoryApi } from '@/lib/dashboard-api';

/** CSS-variable colour references shared by every dashboard chart. */
export const dashboardChartTokens = {
  /** Volt-Lime selection/hover accent (contrast-tuned per theme in CSS). */
  highlight: 'var(--sem-chart-highlight)',
  grid: 'var(--color-border)',
  axis: 'var(--color-muted-foreground)',
  track: 'var(--color-muted)',
  /** Previous-period comparison series. */
  comparison: 'var(--color-muted-foreground)',
} as const;

/**
 * Canonical payment-method identity colours. Keyed by the normalized method
 * slug (see `normalizePaymentMethod`). Every value is a CSS variable, so the
 * doughnut and its legend always agree and re-theme together.
 */
export const paymentMethodColorMap: Record<string, string> = {
  cash: 'var(--pm-cash)',
  card: 'var(--pm-card)',
  bank: 'var(--pm-bank)',
  qr: 'var(--pm-qr)',
  credit: 'var(--pm-credit)',
  cheque: 'var(--pm-cheque)',
  split: 'var(--pm-split)',
  other: 'var(--pm-other)',
};

/** Teal→Aqua intensity ramp for category ranking bars (Option B default). */
export const categoryChartColorScale = [
  'var(--cat-1)',
  'var(--cat-2)',
  'var(--cat-3)',
  'var(--cat-4)',
  'var(--cat-5)',
] as const;

/** Colour for the Nth-ranked category bar (clamps to the ramp length). */
export function categoryColorAt(index: number): string {
  return (
    categoryChartColorScale[Math.min(index, categoryChartColorScale.length - 1)] ??
    categoryChartColorScale[0]
  );
}

/** Payment identity colour for a method slug, with a neutral fallback. */
function paymentColor(slug: string): string {
  return paymentMethodColorMap[slug] ?? 'var(--pm-other)';
}

// ── formatters ───────────────────────────────────────────────────────────────

/** Currency for dashboard charts — single source, always LKR. */
export const formatDashboardCurrency = formatMoney;

/**
 * Percentage for chart labels. Keeps one decimal for small slices so a 0.4%
 * method never collapses to "0%" and misrepresents the total, whole numbers
 * otherwise for a calmer read.
 */
export function formatDashboardPercentage(fraction: number): string {
  const pct = fraction * 100;
  if (!Number.isFinite(pct) || pct <= 0) return '0%';
  if (pct < 1) return `${pct.toFixed(1)}%`;
  if (pct < 10 && !Number.isInteger(pct)) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

// ── payment methods ──────────────────────────────────────────────────────────

/** Human labels for known payment methods. */
const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank Transfer',
  QR_PAYMENT: 'QR / Wallet',
  CHECK: 'Cheque',
  CHEQUE: 'Cheque',
  STORE_CREDIT: 'Credit',
  CREDIT: 'Credit',
  SPLIT: 'Split Payment',
};

/** Map a raw API method to its colour-map slug. */
function paymentSlug(method: string): keyof typeof paymentMethodColorMap {
  switch (method.toUpperCase()) {
    case 'CASH':
      return 'cash';
    case 'CARD':
      return 'card';
    case 'BANK_TRANSFER':
      return 'bank';
    case 'QR_PAYMENT':
      return 'qr';
    case 'STORE_CREDIT':
    case 'CREDIT':
      return 'credit';
    case 'CHECK':
    case 'CHEQUE':
      return 'cheque';
    case 'SPLIT':
      return 'split';
    default:
      return 'other';
  }
}

export interface PaymentSlice {
  key: string;
  label: string;
  amount: number;
  count: number;
  /** Share of the collected total, 0–1. */
  fraction: number;
  color: string;
}

export type PaymentMetric = 'amount' | 'transactions';

export interface PaymentBreakdown {
  slices: PaymentSlice[];
  /** Sum of the active metric across all methods (money for amount, count for txns). */
  total: number;
  /** Total collected revenue, always available for the centre label. */
  totalAmount: number;
  /** Total transaction count across methods. */
  totalCount: number;
  /** True when exactly one method carries the whole total. */
  singleMethod: boolean;
}

/**
 * Build the doughnut view-model for the chosen metric: sort by that metric desc,
 * keep the five largest and fold the remainder into a single "Other" slice, and
 * compute each slice's real share of the total. Never fabricates a slice — an
 * empty input yields an empty breakdown so the card can show its empty state.
 * All slice fractions derive from the same total the centre displays.
 */
export function buildPaymentBreakdown(
  totals: PaymentMethodTotal[],
  metric: PaymentMetric = 'amount',
  maxSlices = 6,
): PaymentBreakdown {
  const valueOf = (t: PaymentMethodTotal) => (metric === 'amount' ? t.amount : (t.count ?? 0));
  const positive = totals.filter((t) => valueOf(t) > 0);
  const total = positive.reduce((s, t) => s + valueOf(t), 0);
  const totalAmount = totals.reduce((s, t) => s + Math.max(0, t.amount), 0);
  const totalCount = totals.reduce((s, t) => s + Math.max(0, t.count ?? 0), 0);

  if (total <= 0) {
    return { slices: [], total: 0, totalAmount, totalCount, singleMethod: false };
  }

  const sorted = [...positive].sort((a, b) => valueOf(b) - valueOf(a));
  const primary = sorted.slice(0, maxSlices - 1);
  const rest = sorted.slice(maxSlices - 1);

  const slices: PaymentSlice[] = primary.map((t) => {
    const slug = paymentSlug(t.method);
    return {
      key: t.method,
      label: PAYMENT_LABELS[t.method.toUpperCase()] ?? titleCase(t.method),
      amount: t.amount,
      count: t.count ?? 0,
      fraction: valueOf(t) / total,
      color: paymentColor(slug),
    };
  });

  if (rest.length > 0) {
    const restValue = rest.reduce((s, t) => s + valueOf(t), 0);
    slices.push({
      key: '__other__',
      label: `Other (${rest.length})`,
      amount: rest.reduce((s, t) => s + t.amount, 0),
      count: rest.reduce((s, t) => s + (t.count ?? 0), 0),
      fraction: restValue / total,
      color: paymentColor('other'),
    });
  }

  // When the largest slice IS the whole total, `sorted.length === 1`.
  return { slices, total, totalAmount, totalCount, singleMethod: sorted.length === 1 };
}

// ── top categories ───────────────────────────────────────────────────────────

export type CategoryMetric = 'amount' | 'units' | 'count';

export interface CategoryBar {
  key: string;
  rank: number;
  label: string;
  amount: number;
  units: number;
  count: number;
  /** Value of the currently-selected metric. */
  metricValue: number;
  /** Share of the metric total across shown rows, 0–1. */
  contribution: number;
  /** Bar width relative to the largest row, 0–1. */
  ratio: number;
  color: string;
}

/**
 * Build ranked category bars for the selected metric. Rows arrive pre-sorted by
 * revenue from the API; we re-sort for the active metric, rank them, and compute
 * each row's contribution to the shown total plus its bar ratio to the leader.
 */
export function buildCategoryBars(
  categories: RankedCategoryApi[],
  metric: CategoryMetric,
): CategoryBar[] {
  const valueOf = (c: RankedCategoryApi) =>
    metric === 'amount' ? c.amount : metric === 'units' ? (c.units ?? 0) : (c.count ?? 0);

  const positive = categories.filter((c) => valueOf(c) > 0);
  const total = positive.reduce((s, c) => s + valueOf(c), 0);
  const max = positive.reduce((m, c) => Math.max(m, valueOf(c)), 0);

  return [...positive]
    .sort((a, b) => valueOf(b) - valueOf(a))
    .map((c, i) => {
      const metricValue = valueOf(c);
      return {
        key: c.label,
        rank: i + 1,
        label: c.label,
        amount: c.amount,
        units: c.units ?? 0,
        count: c.count ?? 0,
        metricValue,
        contribution: total > 0 ? metricValue / total : 0,
        ratio: max > 0 ? metricValue / max : 0,
        color: categoryColorAt(i),
      };
    });
}

/** Format a category metric value for display. */
export function formatCategoryMetric(value: number, metric: CategoryMetric): string {
  if (metric === 'amount') return formatDashboardCurrency(value);
  const n = Math.round(value).toLocaleString();
  return metric === 'units' ? `${n} units` : `${n} sales`;
}

// ── accessible summaries ─────────────────────────────────────────────────────

/**
 * Build a plain-language sentence describing a distribution, e.g.
 * "Cash represents 50% of collected revenue, followed by Card at 29%…".
 * Screen readers get real numbers, not just a tooltip.
 */
export function createAccessibleChartSummary(
  lead: string,
  parts: { label: string; fraction: number }[],
): string {
  if (parts.length === 0) return `${lead} No data is available for the selected period.`;
  const phrases = parts
    .slice(0, 4)
    .map((p, i) =>
      i === 0
        ? `${p.label} represents ${formatDashboardPercentage(p.fraction)}`
        : `${p.label} at ${formatDashboardPercentage(p.fraction)}`,
    );
  const joined =
    phrases.length > 1
      ? `${phrases.slice(0, -1).join(', ')}, followed by ${phrases[phrases.length - 1]}`
      : phrases[0];
  return `${lead} ${joined}.`;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
