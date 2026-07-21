/** Shared view-model types for dashboard presentation. Components consume these
 *  — they never re-run business math on raw API rows. */

export type MetricStatus = 'default' | 'success' | 'warning' | 'danger';
export type TrendDirection = 'up' | 'down' | 'neutral';

export interface MetricComparison {
  /** Percentage change, already computed (e.g. 18.4 for +18.4%). */
  value: number;
  direction: TrendDirection;
  /** e.g. "vs last 7 days". */
  label: string;
}

export interface DashboardMetric {
  id: string;
  label: string;
  /** Preformatted display value (currency already run through formatMoney). */
  value: string;
  /** Raw numeric value — when present the card count-ups to it and `format` it. */
  rawValue?: number;
  /** Formatter used with `rawValue` for the animated display. */
  format?: (n: number) => string;
  helpText?: string;
  comparison?: MetricComparison;
  status?: MetricStatus;
  /** Small trend series for the sparkline (raw numbers). */
  spark?: number[];
  /** Short supporting line shown when there is no sparkline/comparison, so the
   *  card never looks unfinished (e.g. "3 completed today"). */
  footnote?: string;
  /** Route to navigate to on click. */
  destination?: string;
  /** Strong surface treatment — reserve for one or two "hero" KPI cards only. */
  surface?: 'hero' | 'aqua';
  /** Icon-well accent colour; the card stays neutral, only the icon is coloured. */
  iconAccent?: 'teal' | 'aqua' | 'info' | 'lime';
}

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertItem {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  /** Preformatted count/badge shown on the right. */
  badge?: string;
  actionLabel: string;
  destination: string;
}

export interface PipelineStage {
  key: string;
  label: string;
  count: number;
  value: number;
  /** Tailwind text/bg accent token suffix, e.g. 'primary', 'success'. */
  tone: 'muted' | 'primary' | 'warning' | 'success' | 'danger';
}

export interface BreakdownRow {
  key: string;
  label: string;
  amount: number;
  /** 0–100. */
  percent: number;
  tone: 'cash' | 'card' | 'bank' | 'qr' | 'credit' | 'other';
}

export interface RankedRow {
  key: string;
  label: string;
  amount: number;
  percent: number;
}

export interface FrequentItem {
  key: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
  amount: number;
}

export interface ShiftSummary {
  isOpen: boolean;
  startedAtLabel: string;
  startingCash: number;
  cashSales: number;
  cardSales: number;
  bankQrSales: number;
  refunds: number;
  expectedCash: number;
  drawerBalance: number;
  /** drawerBalance - expectedCash; negative = short. */
  difference: number;
}

export interface QuickBooksHealth {
  state: 'connected' | 'disconnected' | 'not_configured';
  status: MetricStatus;
  statusLabel: string;
  lastSyncLabel: string | null;
  waitingToSync: number;
  failedSyncs: number;
}
