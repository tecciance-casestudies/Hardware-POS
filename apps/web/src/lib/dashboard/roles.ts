import type { UserRole } from '@/lib/permissions';

/** Which dashboard composition a role sees. Backend permissions remain the
 *  security source of truth — this only shapes the UI. */
export type DashboardVariant = 'admin' | 'cashier';

/**
 * Central role → dashboard resolver. Keep this the ONLY place that maps roles to
 * a dashboard variant so no component hard-codes role-name checks.
 *
 * - OWNER / ADMIN / MANAGER / ACCOUNTANT → the analytical Admin dashboard
 * - CASHIER → the operational Cashier dashboard
 *
 * Pure and side-effect free so it is trivially unit-testable.
 */
export function resolveDashboardVariant(role: UserRole): DashboardVariant {
  return role === 'CASHIER' ? 'cashier' : 'admin';
}

// TODO(test): once a JS test runner is configured in apps/web, cover:
//   resolveDashboardVariant('OWNER')   === 'admin'
//   resolveDashboardVariant('ADMIN')   === 'admin'
//   resolveDashboardVariant('MANAGER') === 'admin'
//   resolveDashboardVariant('CASHIER') === 'cashier'
