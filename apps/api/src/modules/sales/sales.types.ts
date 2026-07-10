import { DiscountType, PaymentMethod, PaymentStatus, QuickBooksDocumentType } from '@hardware-pos/database';

/** Normalized cart line coming into the compute pipeline. */
export interface CartItemInput {
  productId: string;
  quantity: number;
  unitPrice?: number;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  discountReason?: string | null;
  /** Fresh approval token (one-shot completion). */
  approvalToken?: string | null;
  /** Approver already recorded on a draft line (completing a draft). */
  approvedByUserId?: string | null;
}

/** A fully computed sale line, ready to persist. */
export interface ComputedLine {
  productId: string;
  productName: string;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  discountType: DiscountType | null;
  discountValue: number | null;
  discountAmount: number;
  discountReason: string | null;
  approvedByUserId: string | null;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
}

/** Computed sale totals + lines. */
export interface ComputedSale {
  lines: ComputedLine[];
  subtotal: number;
  totalDiscount: number;
  taxAmount: number;
  total: number;
}

export interface PaymentInput {
  method: PaymentMethod;
  amount: number;
  reference?: string | null;
}

/** Everything the repository needs to persist a completed sale. */
export interface PersistSaleInput {
  tenantId: string;
  cashierId: string;
  branchId: string;
  registerId?: string | null;
  customerId?: string | null;
  computed: ComputedSale;
  payments: PaymentInput[];
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: PaymentStatus;
  quickbooksDocumentType: QuickBooksDocumentType;
}
