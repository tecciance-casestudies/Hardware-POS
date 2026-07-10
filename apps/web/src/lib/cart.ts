import type { ClientProduct } from './catalog';
import { round2 } from './utils';

export type DiscountType = 'PERCENTAGE' | 'FIXED';

export interface LineDiscount {
  type: DiscountType;
  value: number;
  reason?: string;
}

export interface CartItem {
  product: ClientProduct;
  quantity: number;
  note?: string;
  discount?: LineDiscount;
  /** Manager approval token for an over-limit discount (from /discounts/approve). */
  approvalToken?: string;
  /** The manager who approved the discount. */
  approvedByUserId?: string;
}

export interface LineTotals {
  lineSubtotal: number;
  discountAmount: number;
  lineTotal: number;
  outOfStock: boolean;
}

export function computeDiscount(lineSubtotal: number, discount?: LineDiscount): number {
  if (!discount || discount.value <= 0) return 0;
  if (discount.type === 'PERCENTAGE') {
    return Math.min(lineSubtotal, round2((lineSubtotal * discount.value) / 100));
  }
  return Math.min(lineSubtotal, round2(discount.value));
}

export function computeLine(item: CartItem): LineTotals {
  const lineSubtotal = round2(item.product.unitPrice * item.quantity);
  const discountAmount = computeDiscount(lineSubtotal, item.discount);
  return {
    lineSubtotal,
    discountAmount,
    lineTotal: round2(lineSubtotal - discountAmount),
    outOfStock: item.quantity > item.product.quantityOnHand,
  };
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  totalDiscount: number;
  taxAmount: number;
  total: number;
  hasStockIssue: boolean;
}

export function computeTotals(items: CartItem[], taxRatePercent: number): CartTotals {
  let subtotal = 0;
  let totalDiscount = 0;
  let itemCount = 0;
  let hasStockIssue = false;

  for (const item of items) {
    const line = computeLine(item);
    subtotal += line.lineSubtotal;
    totalDiscount += line.discountAmount;
    itemCount += item.quantity;
    if (line.outOfStock) hasStockIssue = true;
  }

  subtotal = round2(subtotal);
  totalDiscount = round2(totalDiscount);
  const taxable = round2(subtotal - totalDiscount);
  const taxAmount = taxRatePercent > 0 ? round2((taxable * taxRatePercent) / 100) : 0;

  return {
    itemCount,
    subtotal,
    totalDiscount,
    taxAmount,
    total: round2(taxable + taxAmount),
    hasStockIssue,
  };
}

/** A product to add to the cart maps 1:1 to a starting cart line. */
export function newCartItem(product: ClientProduct): CartItem {
  return { product, quantity: 1 };
}
