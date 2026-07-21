'use client';

import Link from 'next/link';
import { MoreHorizontal, RefreshCw, type LucideIcon } from 'lucide-react';
import * as React from 'react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface HeroAction {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface HeroMeta {
  key: string;
  icon: LucideIcon;
  label: string;
}

/**
 * Shared dashboard hero. One dominant primary action; secondary actions show
 * inline on wide widths and collapse into an accessible "More" menu below a
 * container-query threshold, so the action row never wraps or overflows.
 */
export function DashboardHero({
  greeting,
  name,
  subtitle,
  meta,
  primary,
  secondary = [],
  onRefresh,
  refreshing,
}: {
  greeting: string;
  name: string;
  subtitle: string;
  meta: HeroMeta[];
  primary: HeroAction;
  secondary?: HeroAction[];
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <div className="@container overflow-hidden rounded-2xl border border-border bg-hero-gradient shadow-card">
      <div className="flex flex-col gap-4 p-5 @min-[900px]:flex-row @min-[900px]:items-center @min-[900px]:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight @min-[900px]:text-[1.75rem]">
            {greeting}, {name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          {meta.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
              {meta.map((m, i) => (
                <React.Fragment key={m.key}>
                  {i > 0 ? <span className="text-border" aria-hidden>·</span> : null}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/70 px-2 py-1 ring-1 ring-inset ring-border">
                    <m.icon className="h-3.5 w-3.5" aria-hidden />
                    {m.label}
                  </span>
                </React.Fragment>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link href={primary.href} className={buttonVariants({ size: 'md' })}>
            <primary.icon className="h-4 w-4" aria-hidden />
            {primary.label}
          </Link>

          {/* Inline secondary actions on wide widths. */}
          {secondary.length > 0 ? (
            <div className="hidden items-center gap-2 @min-[1180px]:flex">
              {secondary.map((a) => (
                <Link
                  key={a.key}
                  href={a.href}
                  className={buttonVariants({ variant: 'outline', size: 'md' })}
                >
                  <a.icon className="h-4 w-4" aria-hidden />
                  {a.label}
                </Link>
              ))}
            </div>
          ) : null}

          {/* Collapsed "More" menu below the threshold. */}
          {secondary.length > 0 ? (
            <div className="@min-[1180px]:hidden">
              <MoreMenu actions={secondary} />
            </div>
          ) : null}

          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh dashboard"
              className={buttonVariants({ variant: 'outline', size: 'icon-md' })}
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MoreMenu({ actions }: { actions: HeroAction[] }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        className={buttonVariants({ variant: 'outline', size: 'icon-md' })}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1.5 w-52 overflow-hidden rounded-xl border border-border bg-surface p-1 shadow-pop"
        >
          {actions.map((a) => (
            <Link
              key={a.key}
              href={a.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <a.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              {a.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
