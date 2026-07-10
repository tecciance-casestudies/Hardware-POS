import { DiscountType, UserRole } from '@hardware-pos/database';

/** Signed inside the short-lived approval token. */
export interface DiscountApprovalTokenPayload {
  typ: 'discount-approval';
  tenantId: string;
  productId: string;
  discountType: DiscountType;
  discountValue: number;
  approvedByUserId: string;
  approverRole: UserRole;
}

/** Response of POST /discounts/approve. */
export interface DiscountApprovalResult {
  approved: boolean;
  approvedByUserId: string | null;
  approvalToken: string | null;
  reason?: string;
}
