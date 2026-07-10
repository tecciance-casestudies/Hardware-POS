'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const TABS = [
  { href: '/quickbooks', label: 'Overview' },
  { href: '/quickbooks/connect', label: 'Connect' },
  { href: '/quickbooks/products', label: 'Products' },
  { href: '/quickbooks/sync-log', label: 'Sync Log' },
  { href: '/quickbooks/settings', label: 'Settings' },
];

export function QuickBooksTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
