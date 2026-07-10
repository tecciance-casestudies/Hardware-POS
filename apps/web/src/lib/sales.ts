import { api } from './api';
import type { Session } from './auth';
import type { DiscountType } from './cart';

/** Seeded dev branch/register (the app targets the demo tenant). */
export const DEV_BRANCH_ID = 'brn_dev';
export const DEV_REGISTER_ID = 'reg_dev';

export type PaymentMethodCode =
  | 'CASH'
  | 'CARD'
  | 'BANK_TRANSFER'
  | 'QR_PAYMENT'
  | 'CHECK'
  | 'STORE_CREDIT'
  | 'OTHER';

export interface SaleItemPayload {
  productId: string;
  quantity: number;
  unitPrice?: number;
  discountType?: DiscountType;
  discountValue?: number;
  discountReason?: string;
  approvalToken?: string;
}

export interface SalePaymentPayload {
  method: PaymentMethodCode;
  amount: number;
  reference?: string;
}

export interface CompleteSaleDto {
  branchId: string;
  registerId?: string;
  customerId?: string;
  items: SaleItemPayload[];
  payments: SalePaymentPayload[];
}

export interface CompletedSale {
  id: string;
  saleNumber: string;
  total: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: string;
  quickbooksDocumentType: string | null;
  syncStatus: string;
  /** True for the offline demo (no real sale persisted). */
  demo: boolean;
}

interface ApiSale {
  id: string;
  saleNumber: string;
  total: string | number;
  paidAmount: string | number;
  balanceAmount: string | number;
  paymentStatus: string;
  quickbooksDocumentType: string | null;
  syncStatus: string;
}

function paymentStatusFor(total: number, paid: number): string {
  if (paid <= 0) return 'UNPAID';
  return paid >= total ? 'PAID' : 'PARTIAL';
}

/**
 * Complete a sale. With a real session this calls POST /sales/complete. In the
 * offline demo session it simulates a completed sale so the flow is testable.
 */
export async function completeSale(
  session: Session,
  dto: CompleteSaleDto,
  totals: { total: number },
): Promise<CompletedSale> {
  const paidAmount = Math.round(dto.payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;

  if (session.token.startsWith('mock.')) {
    const suffix = Math.floor(Math.random() * 9000 + 1000);
    return {
      id: `demo-${suffix}`,
      saleNumber: `S-DEMO-${suffix}`,
      total: totals.total,
      paidAmount,
      balanceAmount: Math.max(0, Math.round((totals.total - paidAmount) * 100) / 100),
      paymentStatus: paymentStatusFor(totals.total, paidAmount),
      quickbooksDocumentType: paidAmount >= totals.total ? 'SALES_RECEIPT' : 'INVOICE',
      syncStatus: 'PENDING',
      demo: true,
    };
  }

  const sale = await api.post<ApiSale>('/sales/complete', dto, {
    token: session.token,
    tenantId: session.user.tenantId,
  });
  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    total: Number(sale.total),
    paidAmount: Number(sale.paidAmount),
    balanceAmount: Number(sale.balanceAmount),
    paymentStatus: sale.paymentStatus,
    quickbooksDocumentType: sale.quickbooksDocumentType,
    syncStatus: sale.syncStatus,
    demo: false,
  };
}
