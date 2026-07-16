'use client';

import * as React from 'react';

import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { CashierDashboard } from '@/components/dashboard/cashier-dashboard';
import { useAuth } from '@/lib/auth';
import { resolveDashboardVariant } from '@/lib/dashboard/roles';

/**
 * Role-based dashboard router. A central resolver decides which composition to
 * render; both dashboards share primitives but stay separate layouts. Backend
 * permissions remain the security source of truth — this only shapes the UI,
 * and financial cards still gate on `hasPermission`.
 */
export default function DashboardPage() {
  const { session, hasPermission } = useAuth();

  if (!session) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading your dashboard…
      </div>
    );
  }

  const variant = resolveDashboardVariant(session.user.role);
  return variant === 'cashier' ? (
    <CashierDashboard session={session} hasPermission={hasPermission} />
  ) : (
    <AdminDashboard session={session} hasPermission={hasPermission} />
  );
}
