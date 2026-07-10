import { UserRole } from '@hardware-pos/database';

/**
 * Fine-grained permissions. Each role maps to a set of these; guards check the
 * authenticated user's role against the permission a route requires.
 *
 * The DB Role/Permission tables remain available for custom per-tenant roles;
 * this code-level map covers the built-in roles for fast, dependency-free checks.
 */
export enum Permission {
  SALE_CREATE = 'sale:create',
  SALE_READ = 'sale:read',
  PAYMENT_CREATE = 'payment:create',
  DISCOUNT_APPROVE = 'discount:approve',
  PRODUCT_READ = 'product:read',
  CUSTOMER_READ = 'customer:read',
  SYNC_READ = 'sync:read',
  QUICKBOOKS_READ = 'quickbooks:read',
  QUICKBOOKS_MANAGE = 'quickbooks:manage',
  SETTINGS_MANAGE = 'settings:manage',
  USER_MANAGE = 'user:manage',
  REPORT_READ = 'report:read',
}

const ALL_PERMISSIONS: Permission[] = Object.values(Permission);

/** Role → permissions. Owner/Admin manage everything. */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  OWNER: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS,
  MANAGER: [
    Permission.SALE_CREATE,
    Permission.SALE_READ,
    Permission.PAYMENT_CREATE,
    Permission.DISCOUNT_APPROVE,
    Permission.PRODUCT_READ,
    Permission.CUSTOMER_READ,
    Permission.REPORT_READ,
  ],
  CASHIER: [
    Permission.SALE_CREATE,
    Permission.SALE_READ,
    Permission.PAYMENT_CREATE,
    Permission.PRODUCT_READ,
    Permission.CUSTOMER_READ,
  ],
  ACCOUNTANT: [
    Permission.SYNC_READ,
    Permission.QUICKBOOKS_READ,
    Permission.SALE_READ,
    Permission.PRODUCT_READ,
    Permission.CUSTOMER_READ,
    Permission.REPORT_READ,
  ],
};

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
