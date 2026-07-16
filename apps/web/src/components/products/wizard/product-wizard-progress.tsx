'use client';

import { AlertTriangle, Check } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';
import type { StepKey, StepStatus } from './types';

export interface ProgressItem {
  key: StepKey;
  label: string;
  status: StepStatus;
  clickable: boolean;
}

/** Horizontal, scrollable step tracker. Completed steps are clickable. */
export function ProductWizardProgress({
  items,
  current,
  onStep,
}: {
  items: ProgressItem[];
  current: StepKey;
  onStep: (key: StepKey) => void;
}) {
  return (
    <nav aria-label="Product setup steps" className="overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1">
        {items.map((item, i) => {
          const active = item.key === current;
          return (
            <React.Fragment key={item.key}>
              <li>
                <button
                  type="button"
                  disabled={!item.clickable && !active}
                  aria-current={active ? 'step' : undefined}
                  onClick={() => onStep(item.key)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                    active && 'bg-brand-50 text-brand-700',
                    !active && item.clickable && 'text-foreground hover:bg-muted',
                    !active && !item.clickable && 'cursor-not-allowed text-muted-foreground/70',
                  )}
                >
                  <StepBadge index={i + 1} status={item.status} active={active} />
                  <span className="whitespace-nowrap">
                    <span className="hidden text-[11px] uppercase tracking-wide text-muted-foreground sm:block">
                      Step {i + 1}
                    </span>
                    {item.label}
                  </span>
                </button>
              </li>
              {i < items.length - 1 ? (
                <li aria-hidden className="h-px w-4 shrink-0 bg-border md:w-8" />
              ) : null}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

function StepBadge({
  index,
  status,
  active,
}: {
  index: number;
  status: StepStatus;
  active: boolean;
}) {
  return (
    <span
      className={cn(
        'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold',
        active && 'bg-primary text-primary-foreground',
        !active && status === 'complete' && 'bg-success text-white',
        !active && status === 'attention' && 'bg-warning text-white',
        !active && (status === 'todo' || status === 'optional') && 'bg-muted text-muted-foreground',
      )}
    >
      {status === 'complete' && !active ? (
        <Check className="h-4 w-4" />
      ) : status === 'attention' && !active ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        index
      )}
    </span>
  );
}
