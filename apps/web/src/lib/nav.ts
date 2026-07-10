import {
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Users,
  Link2,
  type LucideIcon,
} from 'lucide-react';

import { Permission } from './permissions';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** If set, the item is only shown when the user has this permission. */
  permission?: Permission;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pos', label: 'POS', icon: ShoppingCart, permission: Permission.SALE_CREATE },
  { href: '/sales', label: 'Sales', icon: ReceiptText, permission: Permission.SALE_READ },
  { href: '/products', label: 'Products', icon: Package, permission: Permission.PRODUCT_READ },
  { href: '/customers', label: 'Customers', icon: Users, permission: Permission.CUSTOMER_READ },
  { href: '/quickbooks', label: 'QuickBooks', icon: Link2, permission: Permission.QUICKBOOKS_READ },
  { href: '/settings', label: 'Settings', icon: Settings, permission: Permission.SETTINGS_MANAGE },
];
