import { api } from './api';
import type { Session } from './auth';

/** Aggregated store-activity numbers for the dashboard tiles (mirrors the API). */
export interface DashboardStats {
  todaySalesTotal: number;
  todayTransactions: number;
  productsCached: number;
  pendingSyncs: number;
}

/** Raw stats JSON (the sales total is a Prisma Decimal → may arrive as a string). */
type ApiDashboardStats = Omit<DashboardStats, 'todaySalesTotal'> & {
  todaySalesTotal: string | number;
};

export async function fetchDashboardStats(session: Session): Promise<DashboardStats> {
  const s = await api.get<ApiDashboardStats>('/dashboard/stats', {
    token: session.token,
    tenantId: session.user.tenantId,
  });
  return { ...s, todaySalesTotal: Number(s.todaySalesTotal) };
}
