/**
 * Domain enums shared across the POS.
 *
 * Declared as `const` objects + union types so they are safe to use from both
 * the browser and the server without pulling in TypeScript `enum` runtime code.
 */

/** Staff roles. Managers can approve high discounts via manager PIN. */
export const UserRole = {
  Cashier: 'CASHIER',
  Manager: 'MANAGER',
  Admin: 'ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Lifecycle of a sale within the POS. */
export const SaleStatus = {
  Draft: 'DRAFT',
  Completed: 'COMPLETED',
  Voided: 'VOIDED',
  Refunded: 'REFUNDED',
} as const;
export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus];

/** How a completed sale maps to QuickBooks Online. */
export const SaleType = {
  /** Fully paid sale → QuickBooks Sales Receipt. */
  Receipt: 'RECEIPT',
  /** Partial / credit sale → QuickBooks Invoice + Payment. */
  Invoice: 'INVOICE',
} as const;
export type SaleType = (typeof SaleType)[keyof typeof SaleType];

/** Status of an outbound sync to (or inbound pull from) QuickBooks Online. */
export const SyncStatus = {
  Pending: 'PENDING',
  Syncing: 'SYNCING',
  Synced: 'SYNCED',
  Failed: 'FAILED',
} as const;
export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];
