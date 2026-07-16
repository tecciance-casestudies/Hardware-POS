'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen, Store } from 'lucide-react';
import * as React from 'react';

import { NAV_ITEMS } from '@/lib/nav';
import { useAuth } from '@/lib/auth';
import { useSidebar } from '@/lib/sidebar';
import { cn } from '@/lib/utils';

/** Brand lockup shared by the desktop rail and the mobile drawer. */
function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        'flex h-16 items-center gap-2 border-b border-border',
        collapsed ? 'justify-center px-0' : 'px-6',
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Store className="h-5 w-5" />
      </span>
      {!collapsed ? (
        <span className="text-base font-semibold tracking-tight">Hardware POS</span>
      ) : null}
    </div>
  );
}

/**
 * The nav-item list. Rendered identically by the desktop rail and the mobile
 * drawer; only `collapsed` differs (the drawer is always expanded). When
 * collapsed, labels are hidden, icons are centered and a native tooltip
 * (`title`) surfaces each label.
 */
function NavList({ collapsed }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const items = NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <nav className="flex-1 space-y-1 p-3">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              collapsed && 'justify-center gap-0',
              active
                ? 'bg-brand-50 text-brand-700'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed ? <span>{item.label}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

const FOOTER_NOTE = 'QuickBooks is the inventory & accounting master.';

export function Sidebar() {
  const { collapsed, toggleCollapsed, mobileOpen, closeMobile } = useSidebar();
  const pathname = usePathname();

  // Close the mobile drawer whenever the route changes.
  React.useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  // Close the mobile drawer on Escape (mirrors the dialog overlay idiom).
  React.useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeMobile();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, closeMobile]);

  return (
    <>
      {/* Desktop rail: collapses to an icon-only strip. */}
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] md:flex',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <Brand collapsed={collapsed} />
        <NavList collapsed={collapsed} />
        {!collapsed ? (
          <div className="border-t border-border p-4 text-xs text-muted-foreground">
            {FOOTER_NOTE}
          </div>
        ) : null}
        {/* Collapse / expand the rail — preference persists (localStorage). */}
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              collapsed && 'justify-center gap-0',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5 shrink-0" />
            ) : (
              <PanelLeftClose className="h-5 w-5 shrink-0" />
            )}
            {!collapsed ? <span>Collapse</span> : null}
          </button>
        </div>
      </aside>

      {/* Mobile off-canvas drawer. Stays mounted for the slide transition;
          made inert when closed so its links leave the tab order. */}
      <div className="md:hidden" inert={mobileOpen ? undefined : true}>
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeMobile}
          className={cn(
            'fixed inset-0 z-40 bg-slate-900/40 transition-opacity',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
        />
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Brand />
          <NavList />
          <div className="border-t border-border p-4 text-xs text-muted-foreground">
            {FOOTER_NOTE}
          </div>
        </aside>
      </div>
    </>
  );
}
