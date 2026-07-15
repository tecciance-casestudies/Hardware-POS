'use client';

import * as React from 'react';
import { Check, ChevronDown, Loader2, Search, UserRound } from 'lucide-react';

import type { Session } from '@/lib/auth';
import type { ClientCustomer } from '@/lib/catalog';
import { fetchCustomers } from '@/lib/customers-api';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const WALK_IN_INDEX = 0;

/**
 * Searchable customer picker for the cart. Queries the API as you type
 * (debounced, first 20 matches) instead of loading the whole customer base
 * into a native select.
 */
export function CustomerCombobox({
  session,
  customerId,
  customerName,
  onSelect,
}: {
  session: Session;
  customerId: string;
  /** Display name for the current selection (resolved by the caller). */
  customerName: string | null;
  onSelect: (customer: ClientCustomer | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<ClientCustomer[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(WALK_IN_INDEX);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Search while open: immediately on open, debounced while typing.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const t = window.setTimeout(
      () => {
        fetchCustomers(session, {
          search: query.trim() || undefined,
          isActive: 'true',
          pageSize: PAGE_SIZE,
        })
          .then((res) => {
            if (cancelled) return;
            setResults(res.items.map((c) => ({ id: c.id, name: c.name })));
            setActiveIndex(WALK_IN_INDEX);
          })
          .catch((err: unknown) => {
            if (cancelled) return;
            setError(err instanceof Error ? err.message : 'Could not search customers');
            setResults([]);
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      },
      query ? 300 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, query, session]);

  const openPopover = () => {
    setQuery('');
    setOpen(true);
    // Focus the search box once the popover has rendered.
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const pick = (customer: ClientCustomer | null) => {
    onSelect(customer);
    setOpen(false);
  };

  // Flat option list for keyboard navigation: index 0 = walk-in, then results.
  const optionCount = results.length + 1;
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, optionCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(activeIndex === WALK_IN_INDEX ? null : (results[activeIndex - 1] ?? null));
    }
  };

  return (
    <div ref={rootRef} className="relative flex-1">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPopover())}
        className={cn(
          'flex h-11 w-full items-center gap-2 rounded-xl border border-border bg-surface pl-4 pr-3 text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className={cn('flex-1 truncate text-left', !customerId && 'text-muted-foreground')}>
          {customerId ? (customerName ?? 'Customer') : 'Walk-in customer'}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 rounded-2xl border border-border bg-surface p-2 shadow-xl">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search customers…"
              className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <ul role="listbox" aria-label="Customers" className="max-h-64 overflow-auto">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!customerId}
                onClick={() => pick(null)}
                onMouseEnter={() => setActiveIndex(WALK_IN_INDEX)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  activeIndex === WALK_IN_INDEX && 'bg-muted',
                  !customerId && 'font-medium text-primary',
                )}
              >
                Walk-in customer
                {!customerId ? <Check className="h-4 w-4" /> : null}
              </button>
            </li>

            {loading ? (
              <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </li>
            ) : error ? (
              <li className="px-3 py-3 text-sm text-danger">{error}</li>
            ) : results.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">
                {query.trim() ? 'No customers match your search.' : 'No customers yet.'}
              </li>
            ) : (
              results.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={customerId === c.id}
                    onClick={() => pick(c)}
                    onMouseEnter={() => setActiveIndex(i + 1)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      activeIndex === i + 1 && 'bg-muted',
                      customerId === c.id && 'font-medium text-primary',
                    )}
                  >
                    <span className="truncate">{c.name}</span>
                    {customerId === c.id ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
