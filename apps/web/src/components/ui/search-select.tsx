'use client';

import * as React from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Optional right-aligned secondary text (e.g. a count). */
  hint?: string;
}

/**
 * Searchable single-select over a client-side option list: a Select-styled
 * trigger opening a popover with a filter box. Use where a native select
 * would grow unwieldy as options accumulate. Include the "All …" choice as a
 * regular option (usually `{ value: '', label: 'All …' }`).
 */
export function SearchSelect({
  options,
  value,
  onChange,
  ariaLabel,
  searchPlaceholder = 'Search…',
  className,
}: {
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

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

  const openPopover = () => {
    setQuery('');
    setActiveIndex(0);
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const pick = (option: SearchSelectOption) => {
    onChange(option.value);
    setOpen(false);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[activeIndex]) pick(filtered[activeIndex]);
    }
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openPopover())}
        className={cn(
          'flex h-11 min-w-44 items-center gap-2 rounded-xl border border-border bg-surface pl-4 pr-3 text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <span className="flex-1 truncate text-left">{selected?.label ?? ariaLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-40 mt-2 w-64 rounded-2xl border border-border bg-surface p-2 shadow-xl">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder={searchPlaceholder}
              className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <ul role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">No matches.</li>
            ) : (
              filtered.map((o, i) => (
                <li key={o.value || '__all__'}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === o.value}
                    onClick={() => pick(o)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      activeIndex === i && 'bg-muted',
                      value === o.value && 'font-medium text-primary',
                    )}
                  >
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.hint ? <span className="text-xs text-muted-foreground">{o.hint}</span> : null}
                    {value === o.value ? <Check className="h-4 w-4 shrink-0" /> : null}
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
