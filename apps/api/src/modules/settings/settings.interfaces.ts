/** POS-level settings surfaced to the front-end. */
export interface AppSettings {
  currency: string;
  /** Sales tax rate as a percentage. 0 disables tax. */
  taxRatePercent: number;
  taxInclusive: boolean;
  /** Discount percentage above which manager approval is required. */
  highDiscountThresholdPercent: number;
  receiptFooter: string;
}
