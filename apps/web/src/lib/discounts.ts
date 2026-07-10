import { api, ApiError } from './api';
import type { Session } from './auth';
import type { DiscountType } from './cart';

export interface ApprovalRequest {
  managerPin: string;
  productId: string;
  discountType: DiscountType;
  discountValue: number;
  reason?: string;
}

export interface ApprovalResult {
  approved: boolean;
  approvedByUserId: string | null;
  approvalToken: string | null;
  reason?: string;
}

/**
 * Request manager approval for an over-limit discount.
 *
 * With a real session this calls POST /discounts/approve. In the offline demo
 * session (mock token) the backend would reject the request, so we simulate the
 * seeded manager PIN (2222) locally to keep the flow demonstrable.
 */
export async function requestDiscountApproval(
  session: Session,
  input: ApprovalRequest,
): Promise<ApprovalResult> {
  if (session.token.startsWith('mock.')) {
    if (input.managerPin === '2222') {
      return {
        approved: true,
        approvedByUserId: 'usr_manager',
        approvalToken: 'demo-approval-token',
      };
    }
    return { approved: false, approvedByUserId: null, approvalToken: null, reason: 'Invalid manager PIN' };
  }

  try {
    return await api.post<ApprovalResult>('/discounts/approve', input, {
      token: session.token,
      tenantId: session.user.tenantId,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      return { approved: false, approvedByUserId: null, approvalToken: null, reason: 'Invalid manager PIN' };
    }
    throw err;
  }
}
